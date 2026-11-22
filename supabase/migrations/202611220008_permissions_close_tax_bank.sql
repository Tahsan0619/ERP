-- has_permission, grant new codes to owners, proper period close wipe,
-- tax GL split on invoice post, bank reconcile RPC, revoke_invite

create or replace function public.has_permission(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions p on p.id = rp.permission_id
      where ur.user_id = auth.uid()
        and p.code = p_code
    );
$$;

grant execute on function public.has_permission(text) to authenticated;

-- Ensure Owner/Admin roles get every permission (including 007 seeds)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('R-OWNER', 'R-ADMIN')
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- Tax liability / receivable accounts for existing tenants
insert into public.accounts (tenant_id, code, name, account_type)
select t.id, x.code, x.name, x.account_type
from public.tenants t
cross join (values
  ('2200', 'Tax Payable', 'liability'),
  ('1400', 'Tax Receivable', 'asset')
) as x(code, name, account_type)
where not exists (
  select 1 from public.accounts a where a.tenant_id = t.id and a.code = x.code
);

-- Patch bootstrap: tax accounts + MO/PAYR series + owner permission grants
create or replace function public.bootstrap_tenant(
  p_tenant_name text,
  p_full_name text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_company_id uuid;
  v_branch_id uuid;
  v_user_id uuid := auth.uid();
  v_year integer := extract(year from current_date)::integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Profile already exists';
  end if;

  insert into public.tenants (name) values (p_tenant_name) returning id into v_tenant_id;

  insert into public.profiles (id, tenant_id, full_name, email)
  values (v_user_id, v_tenant_id, p_full_name, coalesce(auth.jwt() ->> 'email', ''));

  insert into public.roles (tenant_id, code, name) values
    (v_tenant_id, 'R-OWNER', 'Owner / Director'),
    (v_tenant_id, 'R-ADMIN', 'System Administrator'),
    (v_tenant_id, 'R-SALES', 'Sales User'),
    (v_tenant_id, 'R-PURCHASE', 'Purchase User'),
    (v_tenant_id, 'R-WAREHOUSE', 'Warehouse User'),
    (v_tenant_id, 'R-ACCOUNTANT', 'Accountant');

  insert into public.user_roles (user_id, role_id)
  select v_user_id, r.id from public.roles r where r.tenant_id = v_tenant_id and r.code in ('R-OWNER', 'R-ADMIN');

  insert into public.role_permissions (role_id, permission_id)
  select r.id, p.id
  from public.roles r
  cross join public.permissions p
  where r.tenant_id = v_tenant_id and r.code in ('R-OWNER', 'R-ADMIN');

  insert into public.companies (tenant_id, name, legal_name)
  values (v_tenant_id, p_tenant_name, p_tenant_name)
  returning id into v_company_id;

  insert into public.branches (tenant_id, company_id, code, name)
  values (v_tenant_id, v_company_id, 'HQ', 'Head Office')
  returning id into v_branch_id;

  insert into public.warehouses (tenant_id, branch_id, code, name)
  values (v_tenant_id, v_branch_id, 'MAIN', 'Main Warehouse');

  insert into public.fiscal_years (tenant_id, name, start_date, end_date, is_closed)
  values (
    v_tenant_id,
    v_year::text,
    make_date(v_year, 1, 1),
    make_date(v_year, 12, 31),
    false
  );

  insert into public.uoms (tenant_id, code, name) values
    (v_tenant_id, 'NOS', 'Numbers'),
    (v_tenant_id, 'KG', 'Kilogram'),
    (v_tenant_id, 'PCS', 'Pieces');

  insert into public.tax_templates (tenant_id, name, rate) values
    (v_tenant_id, 'VAT 0%', 0),
    (v_tenant_id, 'VAT 15%', 15);

  insert into public.payment_terms (tenant_id, name, due_days) values
    (v_tenant_id, 'Due on receipt', 0),
    (v_tenant_id, 'Net 30', 30);

  insert into public.number_series (tenant_id, doc_type, prefix, next_number) values
    (v_tenant_id, 'quotation', 'QT-', 1),
    (v_tenant_id, 'sales_order', 'SO-', 1),
    (v_tenant_id, 'delivery_note', 'DN-', 1),
    (v_tenant_id, 'sales_invoice', 'INV-', 1),
    (v_tenant_id, 'purchase_order', 'PO-', 1),
    (v_tenant_id, 'goods_receipt', 'GRN-', 1),
    (v_tenant_id, 'purchase_invoice', 'PINV-', 1),
    (v_tenant_id, 'journal_entry', 'JV-', 1),
    (v_tenant_id, 'stock_transfer', 'ST-', 1),
    (v_tenant_id, 'stock_adjustment', 'SA-', 1),
    (v_tenant_id, 'receipt_entry', 'RCP-', 1),
    (v_tenant_id, 'payment_entry', 'PAY-', 1),
    (v_tenant_id, 'credit_note', 'CN-', 1),
    (v_tenant_id, 'debit_note', 'DNTE-', 1),
    (v_tenant_id, 'production_order', 'MO-', 1),
    (v_tenant_id, 'payroll_run', 'PAYR-', 1);

  insert into public.accounts (tenant_id, code, name, account_type) values
    (v_tenant_id, '1000', 'Cash', 'asset'),
    (v_tenant_id, '1100', 'Bank', 'asset'),
    (v_tenant_id, '1200', 'Accounts Receivable', 'asset'),
    (v_tenant_id, '1300', 'Inventory', 'asset'),
    (v_tenant_id, '1400', 'Tax Receivable', 'asset'),
    (v_tenant_id, '2000', 'Accounts Payable', 'liability'),
    (v_tenant_id, '2200', 'Tax Payable', 'liability'),
    (v_tenant_id, '3000', 'Owner Equity', 'equity'),
    (v_tenant_id, '4000', 'Sales Income', 'income'),
    (v_tenant_id, '5000', 'Cost of Goods Sold', 'expense'),
    (v_tenant_id, '5100', 'Operating Expense', 'expense');

  return v_tenant_id;
end;
$$;

grant execute on function public.bootstrap_tenant(text, text) to authenticated;

-- Period close: wipe each income/expense into retained earnings (3000)
create or replace function public.close_fiscal_year(p_fiscal_year_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fy public.fiscal_years%rowtype;
  v_user uuid := auth.uid();
  v_equity uuid;
  v_acc record;
  v_bal numeric;
  v_je_id uuid;
  v_doc_no text;
  v_net numeric := 0;
begin
  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id;
  if not found then raise exception 'Fiscal year not found'; end if;
  if v_fy.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_fy.is_closed then raise exception 'Already closed'; end if;
  if not (public.has_admin() or public.has_permission('finance.post')) then
    raise exception 'Missing permission to close fiscal year';
  end if;

  v_equity := public.account_id_by_code(v_fy.tenant_id, '3000');
  if v_equity is null then raise exception 'Owner equity account 3000 missing'; end if;

  v_doc_no := public.next_doc_number(v_fy.tenant_id, 'journal_entry');
  insert into public.journal_entries (tenant_id, doc_no, status, entry_date, remarks, created_by)
  values (v_fy.tenant_id, v_doc_no, 'posted', v_fy.end_date, 'Period close ' || v_fy.name, v_user)
  returning id into v_je_id;

  for v_acc in
    select a.id, a.account_type, a.code,
           coalesce(sum(l.debit),0) as debit,
           coalesce(sum(l.credit),0) as credit
    from public.accounts a
    left join public.journal_entry_lines l on l.account_id = a.id
    left join public.journal_entries j on j.id = l.journal_entry_id
      and j.status = 'posted'
      and j.entry_date between v_fy.start_date and v_fy.end_date
    where a.tenant_id = v_fy.tenant_id
      and a.account_type in ('income', 'expense')
    group by a.id, a.account_type, a.code
  loop
    if v_acc.account_type = 'income' then
      v_bal := v_acc.credit - v_acc.debit;
      if v_bal <> 0 then
        v_net := v_net + v_bal;
        insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values
          (v_je_id, v_acc.id, v_bal, 0, 'Close income ' || v_acc.code),
          (v_je_id, v_equity, 0, v_bal, 'RE from ' || v_acc.code);
      end if;
    else
      v_bal := v_acc.debit - v_acc.credit;
      if v_bal <> 0 then
        v_net := v_net - v_bal;
        insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
        values
          (v_je_id, v_equity, v_bal, 0, 'RE from ' || v_acc.code),
          (v_je_id, v_acc.id, 0, v_bal, 'Close expense ' || v_acc.code);
      end if;
    end if;
  end loop;

  -- Empty P&L still locks the year; journal header remains for audit
  update public.fiscal_years set is_closed = true where id = v_fy.id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_fy.tenant_id, v_user, 'fiscal_year', v_fy.id, 'close', jsonb_build_object('net', v_net, 'journal_id', v_je_id));

  return v_je_id;
end;
$$;

grant execute on function public.close_fiscal_year(uuid) to authenticated;

-- Sales invoice: AR = subtotal+tax; Sales = subtotal; Tax Payable = tax
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
  v_tax uuid;
  v_cogs uuid;
  v_inventory uuid;
  v_cogs_amount numeric := 0;
  v_delivered_ok boolean;
  v_je_id uuid;
  v_doc_no text;
  v_subtotal numeric;
  v_tax_amt numeric;
  v_grand numeric;
begin
  if not (public.has_admin() or public.has_permission('sales.post')) then
    raise exception 'Missing sales.post permission';
  end if;

  select * into v_inv from public.sales_invoices where id = p_sales_invoice_id;
  if not found then raise exception 'Sales invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft invoices can be posted'; end if;

  v_subtotal := coalesce(v_inv.subtotal, 0);
  v_tax_amt := coalesce(v_inv.tax_amount, 0);
  v_grand := coalesce(nullif(v_inv.grand_total, 0), v_subtotal + v_tax_amt);
  if v_grand <= 0 then raise exception 'Invoice total must be greater than zero'; end if;

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
  v_tax := public.account_id_by_code(v_inv.tenant_id, '2200');
  if v_ar is null or v_sales is null then raise exception 'Required GL accounts missing'; end if;

  v_doc_no := public.next_doc_number(v_inv.tenant_id, 'journal_entry');
  insert into public.journal_entries (tenant_id, doc_no, status, entry_date, remarks, created_by)
  values (v_inv.tenant_id, v_doc_no, 'posted', v_inv.invoice_date, 'Auto JV for sales invoice ' || v_inv.doc_no, v_user)
  returning id into v_je_id;

  insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
  values (v_je_id, v_ar, v_grand, 0, 'AR ' || v_inv.doc_no);

  if v_tax_amt > 0 and v_tax is not null then
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values
      (v_je_id, v_sales, 0, v_subtotal, 'Sales ' || v_inv.doc_no),
      (v_je_id, v_tax, 0, v_tax_amt, 'Tax ' || v_inv.doc_no);
  else
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values (v_je_id, v_sales, 0, v_grand, 'Sales ' || v_inv.doc_no);
  end if;

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

  update public.sales_invoices
  set status = 'posted', grand_total = v_grand, tax_amount = v_tax_amt, subtotal = v_subtotal
  where id = p_sales_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'sales_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_grand, 'tax_amount', v_tax_amt));

  return v_inv.id;
end;
$$;

grant execute on function public.post_sales_invoice(uuid) to authenticated;

-- Purchase invoice: Expense = subtotal; Tax Receivable = tax; AP = grand
create or replace function public.post_purchase_invoice(p_purchase_invoice_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.purchase_invoices%rowtype;
  v_user uuid := auth.uid();
  v_ap uuid;
  v_exp uuid;
  v_tax uuid;
  v_je_id uuid;
  v_doc_no text;
  v_subtotal numeric;
  v_tax_amt numeric;
  v_grand numeric;
begin
  if not (public.has_admin() or public.has_permission('purchase.post')) then
    raise exception 'Missing purchase.post permission';
  end if;

  select * into v_inv from public.purchase_invoices where id = p_purchase_invoice_id;
  if not found then raise exception 'Purchase invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft bills can be posted'; end if;

  v_subtotal := coalesce(v_inv.subtotal, 0);
  v_tax_amt := coalesce(v_inv.tax_amount, 0);
  v_grand := coalesce(nullif(v_inv.grand_total, 0), v_subtotal + v_tax_amt);
  if v_grand <= 0 then raise exception 'Bill total must be greater than zero'; end if;

  perform public.assert_period_open(v_inv.tenant_id, v_inv.invoice_date);
  v_ap := public.account_id_by_code(v_inv.tenant_id, '2000');
  v_exp := public.account_id_by_code(v_inv.tenant_id, '5100');
  v_tax := public.account_id_by_code(v_inv.tenant_id, '1400');
  if v_ap is null or v_exp is null then raise exception 'Required GL accounts missing'; end if;

  v_doc_no := public.next_doc_number(v_inv.tenant_id, 'journal_entry');
  insert into public.journal_entries (tenant_id, doc_no, status, entry_date, remarks, created_by)
  values (v_inv.tenant_id, v_doc_no, 'posted', v_inv.invoice_date, 'Auto JV for purchase invoice ' || v_inv.doc_no, v_user)
  returning id into v_je_id;

  if v_tax_amt > 0 and v_tax is not null then
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values
      (v_je_id, v_exp, v_subtotal, 0, 'Expense ' || v_inv.doc_no),
      (v_je_id, v_tax, v_tax_amt, 0, 'Tax ' || v_inv.doc_no),
      (v_je_id, v_ap, 0, v_grand, 'AP ' || v_inv.doc_no);
  else
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values
      (v_je_id, v_exp, v_grand, 0, 'Expense ' || v_inv.doc_no),
      (v_je_id, v_ap, 0, v_grand, 'AP ' || v_inv.doc_no);
  end if;

  update public.purchase_invoices
  set status = 'posted', grand_total = v_grand, tax_amount = v_tax_amt, subtotal = v_subtotal
  where id = p_purchase_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'purchase_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_grand, 'tax_amount', v_tax_amt));

  return v_inv.id;
end;
$$;

grant execute on function public.post_purchase_invoice(uuid) to authenticated;

create or replace function public.post_production_order(p_production_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.production_orders%rowtype;
  v_bom public.boms%rowtype;
  v_comp record;
  v_rate numeric;
  v_user uuid := auth.uid();
begin
  if not (public.has_admin() or public.has_permission('mfg.post')) then
    raise exception 'Missing mfg.post permission';
  end if;

  select * into v_po from public.production_orders where id = p_production_order_id;
  if not found then raise exception 'Production order not found'; end if;
  if v_po.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_po.status <> 'draft' then raise exception 'Only draft production orders can be posted'; end if;
  perform public.assert_period_open(v_po.tenant_id, v_po.posting_date);

  select * into v_bom from public.boms where id = v_po.bom_id;
  for v_comp in select * from public.bom_items where bom_id = v_po.bom_id
  loop
    select valuation_rate into v_rate from public.items where id = v_comp.component_item_id;
    perform public.apply_stock_move(
      v_po.tenant_id, v_comp.component_item_id, v_po.warehouse_id, 'production_issue',
      0, v_comp.qty * v_po.qty, coalesce(v_rate,0), 'production_order', v_po.id, v_user
    );
  end loop;

  select valuation_rate into v_rate from public.items where id = v_bom.finished_item_id;
  perform public.apply_stock_move(
    v_po.tenant_id, v_bom.finished_item_id, v_po.warehouse_id, 'production_receipt',
    v_po.qty, 0, coalesce(v_rate,0), 'production_order', v_po.id, v_user
  );

  update public.production_orders set status = 'posted' where id = v_po.id;
  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_po.tenant_id, v_user, 'production_order', v_po.id, 'post', jsonb_build_object('qty', v_po.qty));
  return v_po.id;
end;
$$;

create or replace function public.post_payroll_run(p_payroll_run_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pr public.payroll_runs%rowtype;
  v_user uuid := auth.uid();
  v_expense uuid;
  v_cash uuid;
begin
  if not (public.has_admin() or public.has_permission('hr.manage')) then
    raise exception 'Missing hr.manage permission';
  end if;

  select * into v_pr from public.payroll_runs where id = p_payroll_run_id;
  if not found then raise exception 'Payroll run not found'; end if;
  if v_pr.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_pr.status <> 'draft' then raise exception 'Only draft payroll can be posted'; end if;
  if v_pr.total_amount <= 0 then raise exception 'Payroll total must be greater than zero'; end if;

  perform public.assert_period_open(v_pr.tenant_id, v_pr.period_end);
  v_expense := public.account_id_by_code(v_pr.tenant_id, '5100');
  v_cash := public.account_id_by_code(v_pr.tenant_id, '1000');
  perform public.create_auto_journal(
    v_pr.tenant_id, v_pr.period_end,
    'Payroll ' || v_pr.doc_no,
    v_expense, v_cash, v_pr.total_amount, v_user
  );

  update public.payroll_runs set status = 'posted' where id = v_pr.id;
  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_pr.tenant_id, v_user, 'payroll_run', v_pr.id, 'post', jsonb_build_object('total', v_pr.total_amount));
  return v_pr.id;
end;
$$;

grant execute on function public.post_production_order(uuid) to authenticated;
grant execute on function public.post_payroll_run(uuid) to authenticated;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin() then raise exception 'Admin only'; end if;
  update public.invites
  set status = 'revoked'
  where id = p_invite_id
    and tenant_id = public.current_tenant_id()
    and status = 'pending';
  if not found then raise exception 'Invite not found or not pending'; end if;
end;
$$;

grant execute on function public.revoke_invite(uuid) to authenticated;

create or replace function public.reconcile_bank_line(
  p_line_id uuid,
  p_payment_id uuid default null,
  p_receipt_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.bank_statement_lines%rowtype;
  v_amt numeric;
  v_user uuid := auth.uid();
begin
  if not (public.has_admin() or public.has_permission('bank.reconcile')) then
    raise exception 'Missing bank.reconcile permission';
  end if;
  if (p_payment_id is null and p_receipt_id is null)
     or (p_payment_id is not null and p_receipt_id is not null) then
    raise exception 'Provide exactly one of payment or receipt';
  end if;

  select * into v_line from public.bank_statement_lines where id = p_line_id;
  if not found then raise exception 'Statement line not found'; end if;
  if v_line.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_line.is_reconciled then raise exception 'Already reconciled'; end if;

  if p_payment_id is not null then
    select amount into v_amt from public.payment_entries
    where id = p_payment_id and tenant_id = v_line.tenant_id and status = 'posted';
    if not found then raise exception 'Payment not found'; end if;
    if abs(abs(v_line.amount) - abs(v_amt)) > 0.009 then
      raise exception 'Amount mismatch between statement line and payment';
    end if;
  else
    select amount into v_amt from public.receipt_entries
    where id = p_receipt_id and tenant_id = v_line.tenant_id and status = 'posted';
    if not found then raise exception 'Receipt not found'; end if;
    if abs(abs(v_line.amount) - abs(v_amt)) > 0.009 then
      raise exception 'Amount mismatch between statement line and receipt';
    end if;
  end if;

  update public.bank_statement_lines
  set is_reconciled = true,
      matched_payment_id = p_payment_id,
      matched_receipt_id = p_receipt_id
  where id = p_line_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (
    v_line.tenant_id, v_user, 'bank_statement_line', v_line.id, 'reconcile',
    jsonb_build_object('payment_id', p_payment_id, 'receipt_id', p_receipt_id, 'amount', v_line.amount)
  );

  return p_line_id;
end;
$$;

grant execute on function public.reconcile_bank_line(uuid, uuid, uuid) to authenticated;
