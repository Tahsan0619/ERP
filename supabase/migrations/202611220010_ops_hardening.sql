-- Ops hardening: stock error messages, delivery note posting, demo opening stock backfill

create extension if not exists pgcrypto;

create or replace function public.apply_stock_move(
  p_tenant_id uuid,
  p_item_id uuid,
  p_warehouse_id uuid,
  p_entry_type text,
  p_qty_in numeric,
  p_qty_out numeric,
  p_valuation_rate numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_ctx uuid;
  v_sku text;
  v_wh_code text;
  v_before numeric;
begin
  v_ctx := public.current_tenant_id();
  if v_ctx is null then
    raise exception 'No tenant context';
  end if;
  if p_tenant_id is distinct from v_ctx then
    raise exception 'Forbidden';
  end if;

  insert into public.stock_ledger (
    tenant_id, item_id, warehouse_id, entry_type, qty_in, qty_out,
    valuation_rate, reference_type, reference_id, created_by
  ) values (
    p_tenant_id, p_item_id, p_warehouse_id, p_entry_type, coalesce(p_qty_in,0), coalesce(p_qty_out,0),
    coalesce(p_valuation_rate,0), p_reference_type, p_reference_id, p_user_id
  );

  insert into public.stock_balances (tenant_id, item_id, warehouse_id, qty_on_hand, qty_reserved)
  values (p_tenant_id, p_item_id, p_warehouse_id, coalesce(p_qty_in,0) - coalesce(p_qty_out,0), 0)
  on conflict (tenant_id, item_id, warehouse_id)
  do update set qty_on_hand = public.stock_balances.qty_on_hand + coalesce(p_qty_in,0) - coalesce(p_qty_out,0);

  select qty_on_hand into v_balance
  from public.stock_balances
  where tenant_id = p_tenant_id and item_id = p_item_id and warehouse_id = p_warehouse_id;

  if v_balance < 0 then
    select i.sku into v_sku from public.items i where i.id = p_item_id and i.tenant_id = p_tenant_id;
    select w.code into v_wh_code from public.warehouses w where w.id = p_warehouse_id and w.tenant_id = p_tenant_id;
    v_before := v_balance + coalesce(p_qty_out, 0);
    raise exception 'Insufficient stock for SKU % (available %, requested %) in warehouse %',
      coalesce(v_sku, p_item_id::text),
      coalesce(v_before, 0),
      coalesce(p_qty_out, 0),
      coalesce(v_wh_code, p_warehouse_id::text);
  end if;

  if coalesce(p_qty_in,0) > 0 and coalesce(p_valuation_rate,0) > 0 then
    update public.items
    set valuation_rate = case
      when valuation_rate <= 0 then p_valuation_rate
      else ((valuation_rate + p_valuation_rate) / 2.0)
    end
    where id = p_item_id and tenant_id = p_tenant_id;
  end if;
end;
$$;

revoke all on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) from public;
revoke all on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) from authenticated;
grant execute on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) to postgres;
grant execute on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) to service_role;

create or replace function public.post_delivery_note(p_delivery_note_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dn public.delivery_notes%rowtype;
  v_line record;
  v_rate numeric;
  v_avail numeric;
  v_user uuid := auth.uid();
begin
  if not (public.has_admin() or public.has_permission('sales.post')) then
    raise exception 'Missing sales.post permission';
  end if;

  select * into v_dn from public.delivery_notes where id = p_delivery_note_id;
  if not found then raise exception 'Delivery note not found'; end if;
  if v_dn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_dn.status <> 'draft' then raise exception 'Only draft delivery notes can be posted'; end if;

  perform public.assert_period_open(v_dn.tenant_id, v_dn.posting_date);

  for v_line in
    select dni.*, i.sku
    from public.delivery_note_items dni
    join public.items i on i.id = dni.item_id and i.tenant_id = v_dn.tenant_id
    where dni.delivery_note_id = p_delivery_note_id
  loop
    select coalesce(sb.qty_on_hand, 0) into v_avail
    from public.stock_balances sb
    where sb.tenant_id = v_dn.tenant_id
      and sb.item_id = v_line.item_id
      and sb.warehouse_id = v_dn.warehouse_id;

    if v_avail < v_line.qty then
      raise exception 'Insufficient stock for SKU % (available %, required %) for delivery %',
        v_line.sku, v_avail, v_line.qty, v_dn.doc_no;
    end if;
  end loop;

  for v_line in
    select * from public.delivery_note_items where delivery_note_id = p_delivery_note_id
  loop
    select valuation_rate into v_rate from public.items where id = v_line.item_id;
    perform public.apply_stock_move(
      v_dn.tenant_id, v_line.item_id, v_dn.warehouse_id, 'delivery',
      0, v_line.qty, coalesce(v_rate,0), 'delivery_note', v_dn.id, v_user
    );

    update public.sales_order_items
    set delivered_qty = delivered_qty + v_line.qty
    where sales_order_id = v_dn.sales_order_id
      and item_id = v_line.item_id;
  end loop;

  update public.delivery_notes set status = 'posted' where id = p_delivery_note_id;

  update public.sales_orders so
  set status = case
    when exists (
      select 1 from public.sales_order_items i
      where i.sales_order_id = so.id and i.delivered_qty < i.qty
    ) then 'partially_delivered'
    else 'delivered'
  end
  where id = v_dn.sales_order_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_dn.tenant_id, v_user, 'delivery_note', v_dn.id, 'post', '{}'::jsonb);

  return v_dn.id;
end;
$$;

grant execute on function public.post_delivery_note(uuid) to authenticated;

create or replace function public.post_goods_receipt(p_goods_receipt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grn public.goods_receipts%rowtype;
  v_line record;
  v_user uuid := auth.uid();
begin
  if not (public.has_admin() or public.has_permission('purchase.post')) then
    raise exception 'Missing purchase.post permission';
  end if;

  select * into v_grn from public.goods_receipts where id = p_goods_receipt_id;
  if not found then raise exception 'Goods receipt not found'; end if;
  if v_grn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_grn.status <> 'draft' then raise exception 'Only draft GRN can be posted'; end if;

  perform public.assert_period_open(v_grn.tenant_id, v_grn.posting_date);

  for v_line in
    select * from public.goods_receipt_items where goods_receipt_id = p_goods_receipt_id
  loop
    perform public.apply_stock_move(
      v_grn.tenant_id, v_line.item_id, v_grn.warehouse_id, 'goods_receipt',
      v_line.qty, 0, v_line.rate, 'goods_receipt', v_grn.id, v_user
    );

    update public.purchase_order_items
    set received_qty = received_qty + v_line.qty
    where purchase_order_id = v_grn.purchase_order_id
      and item_id = v_line.item_id;
  end loop;

  update public.goods_receipts set status = 'posted' where id = p_goods_receipt_id;

  update public.purchase_orders po
  set status = case
    when exists (
      select 1 from public.purchase_order_items i
      where i.purchase_order_id = po.id and i.received_qty < i.qty
    ) then 'partially_received'
    else 'received'
  end
  where id = v_grn.purchase_order_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_grn.tenant_id, v_user, 'goods_receipt', v_grn.id, 'post', '{}'::jsonb);

  return v_grn.id;
end;
$$;

grant execute on function public.post_goods_receipt(uuid) to authenticated;

-- Backfill opening stock for active stock items missing a balance row in the default warehouse (demo-friendly).
do $$
declare
  r record;
  v_wh uuid;
  v_rate numeric;
begin
  for r in
    select i.tenant_id, i.id as item_id, i.valuation_rate
    from public.items i
    where i.is_active = true
      and i.is_stock_item = true
  loop
    select w.id into v_wh
    from public.warehouses w
    where w.tenant_id = r.tenant_id
    order by w.code
    limit 1;

    if v_wh is null then
      continue;
    end if;

    if exists (
      select 1 from public.stock_balances sb
      where sb.tenant_id = r.tenant_id and sb.item_id = r.item_id and sb.warehouse_id = v_wh
    ) then
      continue;
    end if;

    v_rate := coalesce(nullif(r.valuation_rate, 0), 10);

    insert into public.stock_balances (tenant_id, item_id, warehouse_id, qty_on_hand, qty_reserved)
    values (r.tenant_id, r.item_id, v_wh, 100, 0);

    insert into public.stock_ledger (
      tenant_id, item_id, warehouse_id, entry_type, qty_in, qty_out,
      valuation_rate, reference_type, reference_id, created_by
    ) values (
      r.tenant_id, r.item_id, v_wh, 'opening', 100, 0,
      v_rate, 'opening_balance', null, null
    );
  end loop;
end;
$$;

-- Invite tokens: pgcrypto lives in extensions schema on Supabase
create or replace function public.create_invite(p_email text, p_role_code text)
returns table (invite_id uuid, token text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_tenant uuid := public.current_tenant_id();
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_id uuid;
begin
  if v_tenant is null then raise exception 'Not authenticated'; end if;
  if not public.has_admin() then raise exception 'Admin only'; end if;

  insert into public.invites (tenant_id, email, role_code, token, invited_by)
  values (v_tenant, lower(trim(p_email)), coalesce(nullif(p_role_code, ''), 'R-SALES'), v_token, auth.uid())
  returning id into v_id;

  return query select v_id, v_token;
end;
$$;

grant execute on function public.create_invite(text, text) to authenticated;