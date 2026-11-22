-- Security hardening, numbering RPC, GL fixes, bootstrap updates, storage policies

-- ---------- prevent profile tenant_id tampering ----------
create or replace function public.profiles_prevent_tenant_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.tenant_id is distinct from old.tenant_id then
    raise exception 'Cannot change tenant_id on profile';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_prevent_tenant_change on public.profiles;
create trigger trg_profiles_prevent_tenant_change
  before update on public.profiles
  for each row execute function public.profiles_prevent_tenant_change();

drop policy if exists profiles_self_or_tenant on public.profiles;
drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_update_self on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or tenant_id = public.current_tenant_id());

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and tenant_id = public.current_tenant_id());

-- Inserts only via security definer bootstrap_tenant (no insert policy)

-- ---------- admin helper ----------
create or replace function public.has_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select true
      from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      join public.profiles p on p.id = ur.user_id
      where ur.user_id = auth.uid()
        and p.tenant_id = r.tenant_id
        and r.code in ('R-OWNER', 'R-ADMIN')
      limit 1
    ),
    (
      select true
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      join public.permissions perm on perm.id = rp.permission_id
      join public.profiles p on p.id = ur.user_id
      join public.roles r on r.id = ur.role_id
      where ur.user_id = auth.uid()
        and p.tenant_id = r.tenant_id
        and perm.code = 'admin.users'
      limit 1
    ),
    false
  );
$$;

grant execute on function public.has_admin() to authenticated;

drop policy if exists user_roles_tenant on public.user_roles;
drop policy if exists user_roles_select on public.user_roles;
drop policy if exists user_roles_admin_write on public.user_roles;

create policy user_roles_select on public.user_roles
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      join public.roles r on r.id = role_id
      where p.id = auth.uid() and p.tenant_id = r.tenant_id
    )
  );

create policy user_roles_admin_write on public.user_roles
  for insert to authenticated
  with check (
    public.has_admin()
    and exists (
      select 1 from public.roles r
      join public.profiles p on p.id = auth.uid()
      where r.id = role_id and r.tenant_id = p.tenant_id
    )
  );

create policy user_roles_admin_delete on public.user_roles
  for delete to authenticated
  using (
    public.has_admin()
    and exists (
      select 1 from public.roles r
      join public.profiles p on p.id = auth.uid()
      where r.id = role_id and r.tenant_id = p.tenant_id
    )
  );

drop policy if exists role_permissions_tenant on public.role_permissions;
drop policy if exists role_permissions_select on public.role_permissions;
drop policy if exists role_permissions_admin_write on public.role_permissions;

create policy role_permissions_select on public.role_permissions
  for select to authenticated
  using (
    exists (
      select 1 from public.roles r
      join public.profiles p on p.tenant_id = r.tenant_id
      where r.id = role_id and p.id = auth.uid()
    )
  );

create policy role_permissions_admin_insert on public.role_permissions
  for insert to authenticated
  with check (
    public.has_admin()
    and exists (
      select 1 from public.roles r
      join public.profiles p on p.id = auth.uid()
      where r.id = role_id and r.tenant_id = p.tenant_id
    )
  );

create policy role_permissions_admin_delete on public.role_permissions
  for delete to authenticated
  using (
    public.has_admin()
    and exists (
      select 1 from public.roles r
      join public.profiles p on p.id = auth.uid()
      where r.id = role_id and r.tenant_id = p.tenant_id
    )
  );

-- ---------- atomic doc numbering ----------
create or replace function public.next_doc_number(p_tenant_id uuid, p_doc_type text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_next integer;
  v_series_id uuid;
  v_doc_no text;
begin
  if p_tenant_id is distinct from public.current_tenant_id() then
    raise exception 'Forbidden';
  end if;

  select id, prefix, next_number into v_series_id, v_prefix, v_next
  from public.number_series
  where tenant_id = p_tenant_id and doc_type = p_doc_type
  for update;

  if v_series_id is null then
    raise exception 'Number series missing for %', p_doc_type;
  end if;

  v_doc_no := v_prefix || lpad(v_next::text, 5, '0');
  update public.number_series set next_number = v_next + 1 where id = v_series_id;
  return v_doc_no;
end;
$$;

grant execute on function public.next_doc_number(uuid, text) to authenticated;

-- ---------- storage bucket + tenant-scoped policies ----------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_tenant_select on storage.objects;
drop policy if exists attachments_tenant_insert on storage.objects;
drop policy if exists attachments_tenant_update on storage.objects;
drop policy if exists attachments_tenant_delete on storage.objects;

create policy attachments_tenant_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_tenant_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

create policy attachments_tenant_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] = public.current_tenant_id()::text
  );

-- ---------- bootstrap_tenant: fiscal year + number series ----------
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
    (v_tenant_id, 'debit_note', 'DNTE-', 1);

  insert into public.accounts (tenant_id, code, name, account_type) values
    (v_tenant_id, '1000', 'Cash', 'asset'),
    (v_tenant_id, '1100', 'Bank', 'asset'),
    (v_tenant_id, '1200', 'Accounts Receivable', 'asset'),
    (v_tenant_id, '1300', 'Inventory', 'asset'),
    (v_tenant_id, '2000', 'Accounts Payable', 'liability'),
    (v_tenant_id, '3000', 'Owner Equity', 'equity'),
    (v_tenant_id, '4000', 'Sales Income', 'income'),
    (v_tenant_id, '5000', 'Cost of Goods Sold', 'expense'),
    (v_tenant_id, '5100', 'Operating Expense', 'expense');

  return v_tenant_id;
end;
$$;

insert into public.number_series (tenant_id, doc_type, prefix, next_number)
select t.id, v.doc_type, v.prefix, 1
from public.tenants t
cross join (
  values
    ('receipt_entry', 'RCP-'),
    ('payment_entry', 'PAY-'),
    ('credit_note', 'CN-'),
    ('debit_note', 'DNTE-')
) as v(doc_type, prefix)
where not exists (
  select 1 from public.number_series ns
  where ns.tenant_id = t.id and ns.doc_type = v.doc_type
);

-- ---------- GL fixes: purchase + sales invoice posting ----------
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
  v_expense uuid;
begin
  select * into v_inv from public.purchase_invoices where id = p_purchase_invoice_id;
  if not found then raise exception 'Purchase invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft bills can be posted'; end if;
  if v_inv.grand_total <= 0 then raise exception 'Bill total must be greater than zero'; end if;

  perform public.assert_period_open(v_inv.tenant_id, v_inv.invoice_date);
  v_ap := public.account_id_by_code(v_inv.tenant_id, '2000');
  v_expense := public.account_id_by_code(v_inv.tenant_id, '5000');

  perform public.create_auto_journal(
    v_inv.tenant_id, v_inv.invoice_date,
    'Auto JV for purchase invoice ' || v_inv.doc_no,
    v_expense, v_ap, v_inv.grand_total, v_user
  );

  update public.purchase_invoices set status = 'posted' where id = p_purchase_invoice_id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_inv.tenant_id, v_user, 'purchase_invoice', v_inv.id, 'post', jsonb_build_object('grand_total', v_inv.grand_total));

  return v_inv.id;
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
  v_ar uuid;
  v_sales uuid;
  v_cogs uuid;
  v_inventory uuid;
  v_cogs_amount numeric := 0;
begin
  select * into v_inv from public.sales_invoices where id = p_sales_invoice_id;
  if not found then raise exception 'Sales invoice not found'; end if;
  if v_inv.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_inv.status <> 'draft' then raise exception 'Only draft invoices can be posted'; end if;
  if v_inv.grand_total <= 0 then raise exception 'Invoice total must be greater than zero'; end if;

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

-- ---------- credit / debit note posting RPCs ----------
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
begin
  select * into v_cn from public.credit_notes where id = p_credit_note_id;
  if not found then raise exception 'Credit note not found'; end if;
  if v_cn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_cn.status <> 'draft' then raise exception 'Only draft credit notes can be posted'; end if;
  if v_cn.grand_total <= 0 then raise exception 'Credit amount must be greater than zero'; end if;

  perform public.assert_period_open(v_cn.tenant_id, v_cn.credit_date);

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
begin
  select * into v_dn from public.debit_notes where id = p_debit_note_id;
  if not found then raise exception 'Debit note not found'; end if;
  if v_dn.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_dn.status <> 'draft' then raise exception 'Only draft debit notes can be posted'; end if;
  if v_dn.grand_total <= 0 then raise exception 'Debit amount must be greater than zero'; end if;

  perform public.assert_period_open(v_dn.tenant_id, v_dn.debit_date);

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

grant execute on function public.post_credit_note(uuid) to authenticated;
grant execute on function public.post_debit_note(uuid) to authenticated;