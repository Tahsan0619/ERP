-- Harden SECURITY DEFINER RPCs, roles/number_series RLS, sales invoice gating, note GL

-- ---------- apply_stock_move: tenant-bound ----------
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

revoke all on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) from public;
revoke all on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) from authenticated;
grant execute on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) to postgres;
grant execute on function public.apply_stock_move(uuid, uuid, uuid, text, numeric, numeric, numeric, text, uuid, uuid) to service_role;

-- ---------- create_auto_journal: tenant-bound ----------
create or replace function public.create_auto_journal(
  p_tenant_id uuid,
  p_date date,
  p_remarks text,
  p_debit_account uuid,
  p_credit_account uuid,
  p_amount numeric,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doc_no text;
  v_prefix text;
  v_next integer;
  v_series_id uuid;
  v_je_id uuid;
  v_ctx uuid;
begin
  v_ctx := public.current_tenant_id();
  if v_ctx is null then
    raise exception 'No tenant context';
  end if;
  if p_tenant_id is distinct from v_ctx then
    raise exception 'Forbidden';
  end if;

  if p_amount <= 0 then
    raise exception 'Journal amount must be greater than zero';
  end if;
  if p_debit_account is null or p_credit_account is null then
    raise exception 'Missing GL accounts for auto journal';
  end if;

  perform public.assert_period_open(p_tenant_id, p_date);

  select id, prefix, next_number into v_series_id, v_prefix, v_next
  from public.number_series
  where tenant_id = p_tenant_id and doc_type = 'journal_entry'
  for update;

  if v_series_id is null then
    raise exception 'Journal number series missing';
  end if;

  v_doc_no := v_prefix || lpad(v_next::text, 5, '0');
  update public.number_series set next_number = v_next + 1 where id = v_series_id;

  insert into public.journal_entries (tenant_id, doc_no, status, entry_date, remarks, created_by)
  values (p_tenant_id, v_doc_no, 'posted', p_date, p_remarks, p_user_id)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit) values
    (v_je_id, p_debit_account, p_amount, 0),
    (v_je_id, p_credit_account, 0, p_amount);

  return v_je_id;
end;
$$;

revoke all on function public.create_auto_journal(uuid, date, text, uuid, uuid, numeric, uuid) from public;
revoke all on function public.create_auto_journal(uuid, date, text, uuid, uuid, numeric, uuid) from authenticated;
grant execute on function public.create_auto_journal(uuid, date, text, uuid, uuid, numeric, uuid) to postgres;
grant execute on function public.create_auto_journal(uuid, date, text, uuid, uuid, numeric, uuid) to service_role;

-- ---------- roles: read for members, writes admin-only ----------
drop policy if exists roles_tenant_all on public.roles;

create policy roles_select on public.roles
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy roles_admin_insert on public.roles
  for insert to authenticated
  with check (public.has_admin() and tenant_id = public.current_tenant_id());

create policy roles_admin_update on public.roles
  for update to authenticated
  using (public.has_admin() and tenant_id = public.current_tenant_id())
  with check (public.has_admin() and tenant_id = public.current_tenant_id());

create policy roles_admin_delete on public.roles
  for delete to authenticated
  using (public.has_admin() and tenant_id = public.current_tenant_id());

-- ---------- number_series: read for members, writes admin-only ----------
drop policy if exists number_series_tenant_all on public.number_series;

create policy number_series_select on public.number_series
  for select to authenticated
  using (tenant_id = public.current_tenant_id());

create policy number_series_admin_insert on public.number_series
  for insert to authenticated
  with check (public.has_admin() and tenant_id = public.current_tenant_id());

create policy number_series_admin_update on public.number_series
  for update to authenticated
  using (public.has_admin() and tenant_id = public.current_tenant_id())
  with check (public.has_admin() and tenant_id = public.current_tenant_id());

create policy number_series_admin_delete on public.number_series
  for delete to authenticated
  using (public.has_admin() and tenant_id = public.current_tenant_id());

-- ---------- post_sales_invoice: require delivery before invoicing ----------
create or replace function public.post_sales_invoice(p_sales_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.sales_invoices%rowtype;
  v_so public.sales_orders%rowtype;
  v_user uuid := auth.uid();
  v_ar uuid;
  v_sales uuid;
  v_cogs uuid;
  v_inventory uuid;
  v_cogs_amount numeric := 0;
  v_delivered_ok boolean;
begin
  select * into v_inv from public.sales_invoices where id = p_sales_invoice_id;
  if not found then raise exception 'Sales invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft invoices can be posted'; end if;
  if v_inv.grand_total <= 0 then raise exception 'Invoice total must be greater than zero'; end if;

  if v_inv.sales_order_id is not null then
    select * into v_so from public.sales_orders where id = v_inv.sales_order_id;
    if not found then raise exception 'Linked sales order not found'; end if;
    v_delivered_ok := v_so.status in ('partially_delivered', 'delivered')
      or exists (
        select 1 from public.delivery_notes dn
        where dn.sales_order_id = v_so.id and dn.status = 'posted'
      );
    if not v_delivered_ok then
      raise exception 'Sales order must be partially or fully delivered (or have a posted delivery note) before invoicing';
    end if;
  end if;

  perform public.assert_period_open(v_inv.tenant_id, v_inv.invoice_date);
  v_ar := public.account_id_by_code(v_inv.tenant_id, '1200');
  v_sales := public.account_id_by_code(v_inv.tenant_id, '4000');

  perform public.create_auto_journal(
    v_inv.tenant_id, v_inv.invoice_date,
    'Auto JV for sales invoice ' || v_inv.doc_no,
    v_ar, v_sales, v_inv.grand_total, v_user
  );

  select coalesce(sum(sii.qty * coalesce(i.valuation_rate, 0)), 0)
  into v_cogs_amount
  from public.sales_invoice_items sii
  join public.items i on i.id = sii.item_id
  where sii.sales_invoice_id = p_sales_invoice_id;

  if v_cogs_amount > 0 then
    v_cogs := public.account_id_by_code(v_inv.tenant_id, '5000');
    v_inventory := public.account_id_by_code(v_inv.tenant_id, '1300');
    perform public.create_auto_journal(
      v_inv.tenant_id, v_inv.invoice_date,
      'Auto COGS for sales invoice ' || v_inv.doc_no,
      v_cogs, v_inventory, v_cogs_amount, v_user
    );
  end if;

  update public.sales_invoices set status = 'posted' where id = p_sales_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'sales_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_inv.grand_total));

  return v_inv.id;
end;
$$;

-- ---------- credit / debit notes: GL on post ----------
create or replace function public.post_credit_note(p_credit_note_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cn public.credit_notes%rowtype;
  v_inv public.sales_invoices%rowtype;
  v_user uuid := auth.uid();
  v_new_paid numeric;
  v_sales uuid;
  v_ar uuid;
begin
  select * into v_cn from public.credit_notes where id = p_credit_note_id;
  if not found then raise exception 'Credit note not found'; end if;
  if v_cn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_cn.status <> 'draft' then raise exception 'Only draft credit notes can be posted'; end if;
  if v_cn.grand_total <= 0 then raise exception 'Credit amount must be greater than zero'; end if;

  perform public.assert_period_open(v_cn.tenant_id, v_cn.credit_date);

  v_sales := public.account_id_by_code(v_cn.tenant_id, '4000');
  v_ar := public.account_id_by_code(v_cn.tenant_id, '1200');

  perform public.create_auto_journal(
    v_cn.tenant_id, v_cn.credit_date,
    'Auto JV for credit note ' || v_cn.doc_no,
    v_sales, v_ar, v_cn.grand_total, v_user
  );

  if v_cn.sales_invoice_id is not null then
    select * into v_inv from public.sales_invoices where id = v_cn.sales_invoice_id;
    if not found then raise exception 'Linked sales invoice not found'; end if;
    v_new_paid := least(v_inv.grand_total, v_inv.amount_paid + v_cn.grand_total);
    update public.sales_invoices set amount_paid = v_new_paid where id = v_inv.id;
  end if;

  update public.credit_notes set status = 'posted' where id = p_credit_note_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (
    v_cn.tenant_id, v_user, 'credit_note', v_cn.id, 'post',
    jsonb_build_object('amount', v_cn.grand_total, 'sales_invoice_id', v_cn.sales_invoice_id)
  );

  return v_cn.id;
end;
$$;

create or replace function public.post_debit_note(p_debit_note_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dn public.debit_notes%rowtype;
  v_inv public.purchase_invoices%rowtype;
  v_user uuid := auth.uid();
  v_new_paid numeric;
  v_ap uuid;
  v_expense uuid;
begin
  select * into v_dn from public.debit_notes where id = p_debit_note_id;
  if not found then raise exception 'Debit note not found'; end if;
  if v_dn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_dn.status <> 'draft' then raise exception 'Only draft debit notes can be posted'; end if;
  if v_dn.grand_total <= 0 then raise exception 'Debit amount must be greater than zero'; end if;

  perform public.assert_period_open(v_dn.tenant_id, v_dn.debit_date);

  v_ap := public.account_id_by_code(v_dn.tenant_id, '2000');
  v_expense := public.account_id_by_code(v_dn.tenant_id, '5000');

  perform public.create_auto_journal(
    v_dn.tenant_id, v_dn.debit_date,
    'Auto JV for debit note ' || v_dn.doc_no,
    v_ap, v_expense, v_dn.grand_total, v_user
  );

  if v_dn.purchase_invoice_id is not null then
    select * into v_inv from public.purchase_invoices where id = v_dn.purchase_invoice_id;
    if not found then raise exception 'Linked purchase invoice not found'; end if;
    v_new_paid := least(v_inv.grand_total, v_inv.amount_paid + v_dn.grand_total);
    update public.purchase_invoices set amount_paid = v_new_paid where id = v_inv.id;
  end if;

  update public.debit_notes set status = 'posted' where id = p_debit_note_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (
    v_dn.tenant_id, v_user, 'debit_note', v_dn.id, 'post',
    jsonb_build_object('amount', v_dn.grand_total, 'purchase_invoice_id', v_dn.purchase_invoice_id)
  );

  return v_dn.id;
end;
$$;