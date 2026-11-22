-- Stage 3 posting RPCs for BusinessOS ERP

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
begin
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
    raise exception 'Insufficient stock for item % in warehouse %', p_item_id, p_warehouse_id;
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
  select * into v_grn from public.goods_receipts where id = p_goods_receipt_id;
  if not found then raise exception 'Goods receipt not found'; end if;
  if v_grn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_grn.status <> 'draft' then raise exception 'Only draft GRN can be posted'; end if;

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
  v_user uuid := auth.uid();
begin
  select * into v_dn from public.delivery_notes where id = p_delivery_note_id;
  if not found then raise exception 'Delivery note not found'; end if;
  if v_dn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_dn.status <> 'draft' then raise exception 'Only draft delivery notes can be posted'; end if;

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

create or replace function public.post_sales_invoice(p_sales_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_user uuid := auth.uid();
begin
  select * into v_inv from public.sales_invoices where id = p_sales_invoice_id;
  if not found then raise exception 'Sales invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft invoices can be posted'; end if;
  if v_inv.grand_total <= 0 then raise exception 'Invoice total must be greater than zero'; end if;

  update public.sales_invoices set status = 'posted' where id = p_sales_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'sales_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_inv.grand_total));

  return v_inv.id;
end;
$$;

create or replace function public.post_purchase_invoice(p_purchase_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.purchase_invoices%rowtype;
  v_user uuid := auth.uid();
begin
  select * into v_inv from public.purchase_invoices where id = p_purchase_invoice_id;
  if not found then raise exception 'Purchase invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft bills can be posted'; end if;
  if v_inv.grand_total <= 0 then raise exception 'Bill total must be greater than zero'; end if;

  update public.purchase_invoices set status = 'posted' where id = p_purchase_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'purchase_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_inv.grand_total));

  return v_inv.id;
end;
$$;

create or replace function public.post_journal_entry(p_journal_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_je public.journal_entries%rowtype;
  v_debit numeric;
  v_credit numeric;
  v_user uuid := auth.uid();
begin
  select * into v_je from public.journal_entries where id = p_journal_entry_id;
  if not found then raise exception 'Journal entry not found'; end if;
  if v_je.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_je.status <> 'draft' then raise exception 'Only draft journals can be posted'; end if;

  select coalesce(sum(debit),0), coalesce(sum(credit),0)
  into v_debit, v_credit
  from public.journal_entry_lines
  where journal_entry_id = p_journal_entry_id;

  if v_debit <> v_credit then
    raise exception 'Journal is unbalanced. Debit %, Credit %', v_debit, v_credit;
  end if;
  if v_debit <= 0 then
    raise exception 'Journal must have amounts';
  end if;

  update public.journal_entries set status = 'posted' where id = p_journal_entry_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_je.tenant_id, v_user, 'journal_entry', v_je.id, 'post', jsonb_build_object('debit', v_debit, 'credit', v_credit));

  return v_je.id;
end;
$$;

create or replace function public.post_receipt_entry(p_receipt_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_re public.receipt_entries%rowtype;
  v_user uuid := auth.uid();
  v_remaining numeric := 0;
  v_inv record;
  v_apply numeric;
begin
  select * into v_re from public.receipt_entries where id = p_receipt_entry_id;
  if not found then raise exception 'Receipt entry not found'; end if;
  if v_re.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_re.status <> 'draft' then raise exception 'Only draft receipts can be posted'; end if;
  if v_re.amount <= 0 then raise exception 'Receipt amount must be greater than zero'; end if;

  v_remaining := v_re.amount;
  for v_inv in
    select id, grand_total, amount_paid
    from public.sales_invoices
    where tenant_id = v_re.tenant_id
      and customer_id = v_re.customer_id
      and status = 'posted'
      and amount_paid < grand_total
    order by invoice_date, created_at
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_inv.grand_total - v_inv.amount_paid);
    update public.sales_invoices
    set amount_paid = amount_paid + v_apply
    where id = v_inv.id;
    v_remaining := v_remaining - v_apply;
  end loop;

  update public.receipt_entries set status = 'posted' where id = p_receipt_entry_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_re.tenant_id, v_user, 'receipt_entry', v_re.id, 'post', jsonb_build_object('amount', v_re.amount));

  return v_re.id;
end;
$$;

create or replace function public.post_payment_entry(p_payment_entry_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pe public.payment_entries%rowtype;
  v_user uuid := auth.uid();
  v_remaining numeric := 0;
  v_inv record;
  v_apply numeric;
begin
  select * into v_pe from public.payment_entries where id = p_payment_entry_id;
  if not found then raise exception 'Payment entry not found'; end if;
  if v_pe.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_pe.status <> 'draft' then raise exception 'Only draft payments can be posted'; end if;
  if v_pe.amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if v_pe.party_type <> 'vendor' or v_pe.vendor_id is null then
    raise exception 'Vendor payment required';
  end if;

  v_remaining := v_pe.amount;
  for v_inv in
    select id, grand_total, amount_paid
    from public.purchase_invoices
    where tenant_id = v_pe.tenant_id
      and vendor_id = v_pe.vendor_id
      and status = 'posted'
      and amount_paid < grand_total
    order by invoice_date, created_at
  loop
    exit when v_remaining <= 0;
    v_apply := least(v_remaining, v_inv.grand_total - v_inv.amount_paid);
    update public.purchase_invoices
    set amount_paid = amount_paid + v_apply
    where id = v_inv.id;
    v_remaining := v_remaining - v_apply;
  end loop;

  update public.payment_entries set status = 'posted' where id = p_payment_entry_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_pe.tenant_id, v_user, 'payment_entry', v_pe.id, 'post', jsonb_build_object('amount', v_pe.amount));

  return v_pe.id;
end;
$$;

grant execute on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) to authenticated;
grant execute on function public.post_goods_receipt(uuid) to authenticated;
grant execute on function public.post_delivery_note(uuid) to authenticated;
grant execute on function public.post_sales_invoice(uuid) to authenticated;
grant execute on function public.post_purchase_invoice(uuid) to authenticated;
grant execute on function public.post_journal_entry(uuid) to authenticated;
grant execute on function public.post_receipt_entry(uuid) to authenticated;
grant execute on function public.post_payment_entry(uuid) to authenticated;
