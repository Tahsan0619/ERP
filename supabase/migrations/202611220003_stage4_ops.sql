-- Stage 4: stock transfer/adjustment posting + report helpers

create or replace function public.post_stock_transfer(p_transfer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.stock_transfers%rowtype;
  v_line record;
  v_rate numeric;
  v_user uuid := auth.uid();
begin
  select * into v_doc from public.stock_transfers where id = p_transfer_id;
  if not found then raise exception 'Stock transfer not found'; end if;
  if v_doc.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_doc.status <> 'draft' then raise exception 'Only draft transfers can be posted'; end if;
  if v_doc.from_warehouse_id = v_doc.to_warehouse_id then
    raise exception 'Source and target warehouse must differ';
  end if;

  for v_line in
    select * from public.stock_transfer_items where transfer_id = p_transfer_id
  loop
    select valuation_rate into v_rate from public.items where id = v_line.item_id;
    perform public.apply_stock_move(
      v_doc.tenant_id, v_line.item_id, v_doc.from_warehouse_id, 'stock_transfer_out',
      0, v_line.qty, coalesce(v_rate,0), 'stock_transfer', v_doc.id, v_user
    );
    perform public.apply_stock_move(
      v_doc.tenant_id, v_line.item_id, v_doc.to_warehouse_id, 'stock_transfer_in',
      v_line.qty, 0, coalesce(v_rate,0), 'stock_transfer', v_doc.id, v_user
    );
  end loop;

  update public.stock_transfers set status = 'posted' where id = p_transfer_id;
  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_doc.tenant_id, v_user, 'stock_transfer', v_doc.id, 'post', '{}'::jsonb);
  return v_doc.id;
end;
$$;

create or replace function public.post_stock_adjustment(p_adjustment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc public.stock_adjustments%rowtype;
  v_line record;
  v_rate numeric;
  v_user uuid := auth.uid();
begin
  select * into v_doc from public.stock_adjustments where id = p_adjustment_id;
  if not found then raise exception 'Stock adjustment not found'; end if;
  if v_doc.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_doc.status <> 'draft' then raise exception 'Only draft adjustments can be posted'; end if;

  for v_line in
    select * from public.stock_adjustment_items where adjustment_id = p_adjustment_id
  loop
    select valuation_rate into v_rate from public.items where id = v_line.item_id;
    if v_line.qty_delta >= 0 then
      perform public.apply_stock_move(
        v_doc.tenant_id, v_line.item_id, v_doc.warehouse_id, 'stock_adjustment_in',
        v_line.qty_delta, 0, coalesce(v_rate,0), 'stock_adjustment', v_doc.id, v_user
      );
    else
      perform public.apply_stock_move(
        v_doc.tenant_id, v_line.item_id, v_doc.warehouse_id, 'stock_adjustment_out',
        0, abs(v_line.qty_delta), coalesce(v_rate,0), 'stock_adjustment', v_doc.id, v_user
      );
    end if;
  end loop;

  update public.stock_adjustments set status = 'posted' where id = p_adjustment_id;
  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_doc.tenant_id, v_user, 'stock_adjustment', v_doc.id, 'post', '{}'::jsonb);
  return v_doc.id;
end;
$$;

grant execute on function public.post_stock_transfer(uuid) to authenticated;
grant execute on function public.post_stock_adjustment(uuid) to authenticated;
