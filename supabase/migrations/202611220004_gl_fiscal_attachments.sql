-- Stage 5: fiscal lock, GL auto journals, attachments, permissions

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  module text not null
);

create table if not exists public.role_permissions (
  role_id uuid not null references public.roles (id) on delete cascade,
  permission_id uuid not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  file_name text not null,
  file_path text not null,
  mime_type text,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.attachments enable row level security;

drop policy if exists permissions_read on public.permissions;
create policy permissions_read on public.permissions for select to authenticated using (true);

drop policy if exists role_permissions_tenant on public.role_permissions;
create policy role_permissions_tenant on public.role_permissions for all using (
  exists (
    select 1 from public.roles r
    join public.profiles p on p.tenant_id = r.tenant_id
    where r.id = role_id and p.id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.roles r
    join public.profiles p on p.tenant_id = r.tenant_id
    where r.id = role_id and p.id = auth.uid()
  )
);

drop policy if exists attachments_tenant_all on public.attachments;
create policy attachments_tenant_all on public.attachments for all
using (tenant_id = public.current_tenant_id())
with check (tenant_id = public.current_tenant_id());

insert into public.permissions (code, name, module) values
  ('sales.view', 'View sales', 'sales'),
  ('sales.create', 'Create sales', 'sales'),
  ('sales.post', 'Post sales', 'sales'),
  ('purchase.view', 'View purchase', 'purchase'),
  ('purchase.create', 'Create purchase', 'purchase'),
  ('purchase.post', 'Post purchase', 'purchase'),
  ('inventory.view', 'View inventory', 'inventory'),
  ('inventory.post', 'Post inventory', 'inventory'),
  ('finance.view', 'View finance', 'finance'),
  ('finance.post', 'Post finance', 'finance'),
  ('admin.users', 'Manage users', 'admin'),
  ('admin.settings', 'Manage settings', 'admin'),
  ('reports.view', 'View reports', 'reports'),
  ('reports.export', 'Export reports', 'reports')
on conflict (code) do nothing;

create or replace function public.assert_period_open(p_tenant_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_closed boolean;
begin
  select exists (
    select 1 from public.fiscal_years fy
    where fy.tenant_id = p_tenant_id
      and fy.is_closed = true
      and p_date between fy.start_date and fy.end_date
  ) into v_closed;

  if v_closed then
    raise exception 'Posting date % is in a locked fiscal year', p_date;
  end if;
end;
$$;

create or replace function public.account_id_by_code(p_tenant_id uuid, p_code text)
returns uuid
language sql
stable
as $$
  select id from public.accounts where tenant_id = p_tenant_id and code = p_code limit 1
$$;

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
begin
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
  v_expense := public.account_id_by_code(v_inv.tenant_id, '1300');

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

  perform public.assert_period_open(v_je.tenant_id, v_je.entry_date);

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
  v_bank uuid;
  v_ar uuid;
begin
  select * into v_re from public.receipt_entries where id = p_receipt_entry_id;
  if not found then raise exception 'Receipt entry not found'; end if;
  if v_re.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_re.status <> 'draft' then raise exception 'Only draft receipts can be posted'; end if;
  if v_re.amount <= 0 then raise exception 'Receipt amount must be greater than zero'; end if;

  perform public.assert_period_open(v_re.tenant_id, v_re.entry_date);
  v_bank := public.account_id_by_code(v_re.tenant_id, '1100');
  v_ar := public.account_id_by_code(v_re.tenant_id, '1200');
  perform public.create_auto_journal(
    v_re.tenant_id, v_re.entry_date,
    'Auto JV for receipt ' || v_re.doc_no,
    v_bank, v_ar, v_re.amount, v_user
  );

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
  v_bank uuid;
  v_ap uuid;
begin
  select * into v_pe from public.payment_entries where id = p_payment_entry_id;
  if not found then raise exception 'Payment entry not found'; end if;
  if v_pe.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_pe.status <> 'draft' then raise exception 'Only draft payments can be posted'; end if;
  if v_pe.amount <= 0 then raise exception 'Payment amount must be greater than zero'; end if;
  if v_pe.party_type <> 'vendor' or v_pe.vendor_id is null then
    raise exception 'Vendor payment required';
  end if;

  perform public.assert_period_open(v_pe.tenant_id, v_pe.entry_date);
  v_bank := public.account_id_by_code(v_pe.tenant_id, '1100');
  v_ap := public.account_id_by_code(v_pe.tenant_id, '2000');
  perform public.create_auto_journal(
    v_pe.tenant_id, v_pe.entry_date,
    'Auto JV for payment ' || v_pe.doc_no,
    v_ap, v_bank, v_pe.amount, v_user
  );

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

grant execute on function public.assert_period_open(uuid, date) to authenticated;
grant execute on function public.account_id_by_code(uuid, text) to authenticated;
grant execute on function public.create_auto_journal(uuid, date, text, uuid, uuid, numeric, uuid) to authenticated;
