-- Remaining gaps: invites, period close, manufacturing, HR, bank recon, portal links

alter table public.profiles
  add column if not exists customer_id uuid references public.customers (id),
  add column if not exists vendor_id uuid references public.vendors (id);

create table if not exists public.invites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role_code text not null default 'R-SALES',
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

create table if not exists public.boms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  finished_item_id uuid not null references public.items (id),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_id uuid not null references public.boms (id) on delete cascade,
  component_item_id uuid not null references public.items (id),
  qty numeric(18,4) not null check (qty > 0)
);

create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  bom_id uuid not null references public.boms (id),
  warehouse_id uuid not null references public.warehouses (id),
  qty numeric(18,4) not null check (qty > 0),
  posting_date date not null default current_date,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  full_name text not null,
  department text,
  designation text,
  join_date date,
  is_active boolean not null default true,
  unique (tenant_id, code)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  attendance_date date not null,
  status text not null check (status in ('present', 'absent', 'leave', 'late')),
  unique (tenant_id, employee_id, attendance_date)
);

create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete cascade,
  leave_type text not null default 'annual',
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  remarks text,
  created_at timestamptz not null default now()
);

create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  total_amount numeric(18,2) not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.payroll_lines (
  id uuid primary key default gen_random_uuid(),
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  employee_id uuid not null references public.employees (id),
  basic_pay numeric(18,2) not null default 0,
  deductions numeric(18,2) not null default 0,
  net_pay numeric(18,2) not null default 0
);

create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  account_id uuid not null references public.accounts (id),
  bank_name text,
  account_no text,
  is_active boolean not null default true
);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts (id) on delete cascade,
  statement_date date not null,
  description text,
  amount numeric(18,2) not null,
  is_reconciled boolean not null default false,
  matched_payment_id uuid references public.payment_entries (id),
  matched_receipt_id uuid references public.receipt_entries (id),
  created_at timestamptz not null default now()
);

alter table public.invites enable row level security;
alter table public.boms enable row level security;
alter table public.bom_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_requests enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_lines enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_statement_lines enable row level security;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'invites','boms','production_orders','employees','attendance','leave_requests',
    'payroll_runs','bank_accounts','bank_statement_lines'
  ]
  loop
    execute format('drop policy if exists %I_tenant_all on public.%I', tbl, tbl);
    execute format(
      'create policy %I_tenant_all on public.%I for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())',
      tbl, tbl
    );
  end loop;
end;
$$;

drop policy if exists bom_items_tenant on public.bom_items;
create policy bom_items_tenant on public.bom_items for all using (
  exists (select 1 from public.boms b where b.id = bom_id and b.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.boms b where b.id = bom_id and b.tenant_id = public.current_tenant_id())
);

drop policy if exists payroll_lines_tenant on public.payroll_lines;
create policy payroll_lines_tenant on public.payroll_lines for all using (
  exists (select 1 from public.payroll_runs p where p.id = payroll_run_id and p.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.payroll_runs p where p.id = payroll_run_id and p.tenant_id = public.current_tenant_id())
);

insert into public.permissions (code, name, module) values
  ('mfg.view', 'View manufacturing', 'manufacturing'),
  ('mfg.post', 'Post manufacturing', 'manufacturing'),
  ('hr.view', 'View HR', 'hr'),
  ('hr.manage', 'Manage HR', 'hr'),
  ('bank.view', 'View bank recon', 'finance'),
  ('bank.reconcile', 'Reconcile bank', 'finance'),
  ('portal.customer', 'Customer portal', 'portal'),
  ('portal.vendor', 'Vendor portal', 'portal')
on conflict (code) do nothing;

create or replace function public.accept_invite(p_token text, p_full_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.invites%rowtype;
  v_role_id uuid;
  v_email text;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_invite from public.invites where token = p_token and status = 'pending';
  if not found then raise exception 'Invite not found or already used'; end if;

  v_email := coalesce(auth.jwt() ->> 'email', '');
  if lower(v_email) <> lower(v_invite.email) then
    raise exception 'Invite email does not match signed-in user';
  end if;

  if exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Profile already exists';
  end if;

  insert into public.profiles (id, tenant_id, full_name, email)
  values (v_user, v_invite.tenant_id, coalesce(nullif(p_full_name, ''), v_email), v_email);

  select id into v_role_id from public.roles
  where tenant_id = v_invite.tenant_id and code = v_invite.role_code
  limit 1;
  if v_role_id is not null then
    insert into public.user_roles (user_id, role_id) values (v_user, v_role_id)
    on conflict do nothing;
  end if;

  update public.invites
  set status = 'accepted', accepted_at = now()
  where id = v_invite.id;

  return v_invite.tenant_id;
end;
$$;

create or replace function public.create_invite(p_email text, p_role_code text)
returns table (invite_id uuid, token text)
language plpgsql
security definer
set search_path = public
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
  v_income numeric := 0;
  v_expense numeric := 0;
  v_net numeric := 0;
  v_acc record;
  v_je_id uuid;
  v_doc_no text;
begin
  select * into v_fy from public.fiscal_years where id = p_fiscal_year_id;
  if not found then raise exception 'Fiscal year not found'; end if;
  if v_fy.tenant_id <> public.current_tenant_id() then raise exception 'Forbidden'; end if;
  if v_fy.is_closed then raise exception 'Already closed'; end if;
  if not public.has_admin() then raise exception 'Admin only'; end if;

  v_equity := public.account_id_by_code(v_fy.tenant_id, '3000');
  if v_equity is null then raise exception 'Owner equity account 3000 missing'; end if;

  -- Net from posted journals in period (income credit-heavy, expense debit-heavy)
  for v_acc in
    select a.id, a.account_type,
           coalesce(sum(l.debit),0) as debit,
           coalesce(sum(l.credit),0) as credit
    from public.accounts a
    left join public.journal_entry_lines l on l.account_id = a.id
    left join public.journal_entries j on j.id = l.journal_entry_id
      and j.status = 'posted'
      and j.entry_date between v_fy.start_date and v_fy.end_date
    where a.tenant_id = v_fy.tenant_id
      and a.account_type in ('income', 'expense')
    group by a.id, a.account_type
  loop
    if v_acc.account_type = 'income' then
      v_income := v_income + (v_acc.credit - v_acc.debit);
    else
      v_expense := v_expense + (v_acc.debit - v_acc.credit);
    end if;
  end loop;

  v_net := v_income - v_expense;
  v_doc_no := public.next_doc_number(v_fy.tenant_id, 'journal_entry');

  insert into public.journal_entries (tenant_id, doc_no, status, entry_date, remarks, created_by)
  values (v_fy.tenant_id, v_doc_no, 'posted', v_fy.end_date, 'Period close ' || v_fy.name, v_user)
  returning id into v_je_id;

  if v_net >= 0 then
    -- close profit into equity: Dr Income summary via net, Cr Equity
    -- Practical single-sided net close: Dr clearing not used; post Cr equity / Dr expense-income net:
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values
      (v_je_id, public.account_id_by_code(v_fy.tenant_id, '4000'), v_net, 0, 'Close income'),
      (v_je_id, v_equity, 0, v_net, 'Retained earnings');
  else
    insert into public.journal_entry_lines (journal_entry_id, account_id, debit, credit, memo)
    values
      (v_je_id, v_equity, abs(v_net), 0, 'Retained earnings'),
      (v_je_id, public.account_id_by_code(v_fy.tenant_id, '5100'), 0, abs(v_net), 'Close expense');
  end if;

  update public.fiscal_years set is_closed = true where id = v_fy.id;

  insert into public.audit_logs (tenant_id, actor_id, entity_type, entity_id, action, details)
  values (v_fy.tenant_id, v_user, 'fiscal_year', v_fy.id, 'close', jsonb_build_object('net', v_net, 'journal_id', v_je_id));

  return v_je_id;
end;
$$;

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

grant execute on function public.accept_invite(text, text) to authenticated;
grant execute on function public.create_invite(text, text) to authenticated;
grant execute on function public.close_fiscal_year(uuid) to authenticated;
grant execute on function public.post_production_order(uuid) to authenticated;
grant execute on function public.post_payroll_run(uuid) to authenticated;

-- number series for new doc types
insert into public.number_series (tenant_id, doc_type, prefix, next_number)
select t.id, x.doc_type, x.prefix, 1
from public.tenants t
cross join (values
  ('production_order','MO-'),
  ('payroll_run','PAYR-')
) as x(doc_type, prefix)
where not exists (
  select 1 from public.number_series ns where ns.tenant_id = t.id and ns.doc_type = x.doc_type
);
