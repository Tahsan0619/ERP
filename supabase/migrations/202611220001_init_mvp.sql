-- BusinessOS ERP MVP schema
-- Required stack: React + TypeScript + Supabase

create extension if not exists "pgcrypto";

-- ---------- helpers ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- tenants / org ----------
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id),
  full_name text not null default '',
  email text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table if not exists public.user_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  primary key (user_id, role_id)
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  legal_name text,
  currency_code text not null default 'BDT',
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  branch_id uuid not null references public.branches (id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table if not exists public.fiscal_years (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_closed boolean not null default false
);

create table if not exists public.uoms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  unique (tenant_id, code)
);

create table if not exists public.item_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  unique (tenant_id, name)
);

create table if not exists public.tax_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  rate numeric(8,4) not null default 0,
  unique (tenant_id, name)
);

create table if not exists public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  due_days integer not null default 0,
  unique (tenant_id, name)
);

create table if not exists public.number_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_type text not null,
  prefix text not null,
  next_number integer not null default 1,
  unique (tenant_id, doc_type)
);

-- ---------- masters ----------
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sku text not null,
  name text not null,
  item_type text not null default 'goods' check (item_type in ('goods', 'service')),
  uom_id uuid references public.uoms (id),
  item_group_id uuid references public.item_groups (id),
  tax_template_id uuid references public.tax_templates (id),
  valuation_rate numeric(18,4) not null default 0,
  reorder_level numeric(18,4) not null default 0,
  is_stock_item boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  email text,
  phone text,
  billing_address text,
  credit_limit numeric(18,2) not null default 0,
  payment_term_id uuid references public.payment_terms (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  email text,
  phone text,
  billing_address text,
  payment_term_id uuid references public.payment_terms (id),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- ---------- inventory ----------
create table if not exists public.stock_balances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  warehouse_id uuid not null references public.warehouses (id) on delete cascade,
  qty_on_hand numeric(18,4) not null default 0,
  qty_reserved numeric(18,4) not null default 0,
  unique (tenant_id, item_id, warehouse_id)
);

create table if not exists public.stock_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  item_id uuid not null references public.items (id),
  warehouse_id uuid not null references public.warehouses (id),
  entry_type text not null,
  qty_in numeric(18,4) not null default 0,
  qty_out numeric(18,4) not null default 0,
  valuation_rate numeric(18,4) not null default 0,
  reference_type text,
  reference_id uuid,
  posted_at timestamptz not null default now(),
  created_by uuid references public.profiles (id)
);

create table if not exists public.stock_transfers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  from_warehouse_id uuid not null references public.warehouses (id),
  to_warehouse_id uuid not null references public.warehouses (id),
  posting_date date not null default current_date,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.stock_transfer_items (
  id uuid primary key default gen_random_uuid(),
  transfer_id uuid not null references public.stock_transfers (id) on delete cascade,
  item_id uuid not null references public.items (id),
  qty numeric(18,4) not null check (qty > 0)
);

create table if not exists public.stock_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  warehouse_id uuid not null references public.warehouses (id),
  posting_date date not null default current_date,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.stock_adjustment_items (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.stock_adjustments (id) on delete cascade,
  item_id uuid not null references public.items (id),
  qty_delta numeric(18,4) not null
);

-- ---------- sales ----------
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'converted', 'cancelled')),
  customer_id uuid not null references public.customers (id),
  quotation_date date not null default current_date,
  valid_till date,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  item_id uuid not null references public.items (id),
  description text,
  qty numeric(18,4) not null,
  rate numeric(18,4) not null,
  tax_rate numeric(8,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'partially_delivered', 'delivered', 'cancelled')),
  customer_id uuid not null references public.customers (id),
  warehouse_id uuid references public.warehouses (id),
  order_date date not null default current_date,
  delivery_date date,
  quotation_id uuid references public.quotations (id),
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  item_id uuid not null references public.items (id),
  description text,
  qty numeric(18,4) not null,
  delivered_qty numeric(18,4) not null default 0,
  rate numeric(18,4) not null,
  tax_rate numeric(8,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0
);

create table if not exists public.delivery_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  sales_order_id uuid not null references public.sales_orders (id),
  customer_id uuid not null references public.customers (id),
  warehouse_id uuid not null references public.warehouses (id),
  posting_date date not null default current_date,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.delivery_note_items (
  id uuid primary key default gen_random_uuid(),
  delivery_note_id uuid not null references public.delivery_notes (id) on delete cascade,
  item_id uuid not null references public.items (id),
  qty numeric(18,4) not null
);

create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  customer_id uuid not null references public.customers (id),
  sales_order_id uuid references public.sales_orders (id),
  delivery_note_id uuid references public.delivery_notes (id),
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.sales_invoice_items (
  id uuid primary key default gen_random_uuid(),
  sales_invoice_id uuid not null references public.sales_invoices (id) on delete cascade,
  item_id uuid not null references public.items (id),
  description text,
  qty numeric(18,4) not null,
  rate numeric(18,4) not null,
  tax_rate numeric(8,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0
);

create table if not exists public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  customer_id uuid not null references public.customers (id),
  sales_invoice_id uuid references public.sales_invoices (id),
  credit_date date not null default current_date,
  grand_total numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

-- ---------- purchase ----------
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'submitted', 'partially_received', 'received', 'cancelled')),
  vendor_id uuid not null references public.vendors (id),
  warehouse_id uuid references public.warehouses (id),
  order_date date not null default current_date,
  expected_date date,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  item_id uuid not null references public.items (id),
  description text,
  qty numeric(18,4) not null,
  received_qty numeric(18,4) not null default 0,
  rate numeric(18,4) not null,
  tax_rate numeric(8,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0
);

create table if not exists public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  purchase_order_id uuid not null references public.purchase_orders (id),
  vendor_id uuid not null references public.vendors (id),
  warehouse_id uuid not null references public.warehouses (id),
  posting_date date not null default current_date,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  goods_receipt_id uuid not null references public.goods_receipts (id) on delete cascade,
  item_id uuid not null references public.items (id),
  qty numeric(18,4) not null,
  rate numeric(18,4) not null default 0
);

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  vendor_id uuid not null references public.vendors (id),
  purchase_order_id uuid references public.purchase_orders (id),
  goods_receipt_id uuid references public.goods_receipts (id),
  invoice_date date not null default current_date,
  due_date date,
  subtotal numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  grand_total numeric(18,2) not null default 0,
  amount_paid numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  purchase_invoice_id uuid not null references public.purchase_invoices (id) on delete cascade,
  item_id uuid not null references public.items (id),
  description text,
  qty numeric(18,4) not null,
  rate numeric(18,4) not null,
  tax_rate numeric(8,4) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  amount numeric(18,2) not null default 0
);

create table if not exists public.debit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  vendor_id uuid not null references public.vendors (id),
  purchase_invoice_id uuid references public.purchase_invoices (id),
  debit_date date not null default current_date,
  grand_total numeric(18,2) not null default 0,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

-- ---------- finance ----------
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  name text not null,
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'income', 'expense')),
  is_active boolean not null default true,
  unique (tenant_id, code)
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  entry_date date not null default current_date,
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete cascade,
  account_id uuid not null references public.accounts (id),
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  memo text
);

create table if not exists public.payment_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  party_type text not null check (party_type in ('customer', 'vendor')),
  customer_id uuid references public.customers (id),
  vendor_id uuid references public.vendors (id),
  entry_date date not null default current_date,
  amount numeric(18,2) not null,
  mode text not null default 'bank',
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

create table if not exists public.receipt_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  doc_no text not null,
  status text not null default 'draft' check (status in ('draft', 'posted', 'cancelled')),
  customer_id uuid not null references public.customers (id),
  entry_date date not null default current_date,
  amount numeric(18,2) not null,
  mode text not null default 'bank',
  remarks text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (tenant_id, doc_no)
);

-- ---------- audit ----------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'items', 'customers', 'vendors']
  loop
    execute format('drop trigger if exists trg_%s_updated_at on public.%I', t, t);
    execute format(
      'create trigger trg_%s_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ---------- tenant helper ----------
create or replace function public.current_tenant_id()
returns uuid
language sql
stable
as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

-- ---------- RLS ----------
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.warehouses enable row level security;
alter table public.fiscal_years enable row level security;
alter table public.uoms enable row level security;
alter table public.item_groups enable row level security;
alter table public.tax_templates enable row level security;
alter table public.payment_terms enable row level security;
alter table public.number_series enable row level security;
alter table public.items enable row level security;
alter table public.customers enable row level security;
alter table public.vendors enable row level security;
alter table public.stock_balances enable row level security;
alter table public.stock_ledger enable row level security;
alter table public.stock_transfers enable row level security;
alter table public.stock_transfer_items enable row level security;
alter table public.stock_adjustments enable row level security;
alter table public.stock_adjustment_items enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.delivery_notes enable row level security;
alter table public.delivery_note_items enable row level security;
alter table public.sales_invoices enable row level security;
alter table public.sales_invoice_items enable row level security;
alter table public.credit_notes enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_items enable row level security;
alter table public.debit_notes enable row level security;
alter table public.accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.payment_entries enable row level security;
alter table public.receipt_entries enable row level security;
alter table public.audit_logs enable row level security;

-- Simple tenant policies for core tables
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'companies','branches','warehouses','fiscal_years','uoms','item_groups','tax_templates','payment_terms','number_series',
    'items','customers','vendors','stock_balances','stock_ledger','stock_transfers','stock_adjustments',
    'quotations','sales_orders','delivery_notes','sales_invoices','credit_notes',
    'purchase_orders','goods_receipts','purchase_invoices','debit_notes',
    'accounts','journal_entries','payment_entries','receipt_entries','audit_logs','roles'
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

drop policy if exists profiles_self_or_tenant on public.profiles;
create policy profiles_self_or_tenant on public.profiles
  for all
  using (id = auth.uid() or tenant_id = public.current_tenant_id())
  with check (id = auth.uid() or tenant_id = public.current_tenant_id());

drop policy if exists tenants_member_select on public.tenants;
create policy tenants_member_select on public.tenants
  for select
  using (id = public.current_tenant_id());

drop policy if exists user_roles_tenant on public.user_roles;
create policy user_roles_tenant on public.user_roles
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.tenant_id = (select tenant_id from public.roles r where r.id = role_id)
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.tenant_id = (select tenant_id from public.roles r where r.id = role_id)
    )
  );

-- child table policies via parent tenant
drop policy if exists quotation_items_tenant on public.quotation_items;
create policy quotation_items_tenant on public.quotation_items for all using (
  exists (select 1 from public.quotations q where q.id = quotation_id and q.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.quotations q where q.id = quotation_id and q.tenant_id = public.current_tenant_id())
);

drop policy if exists sales_order_items_tenant on public.sales_order_items;
create policy sales_order_items_tenant on public.sales_order_items for all using (
  exists (select 1 from public.sales_orders s where s.id = sales_order_id and s.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.sales_orders s where s.id = sales_order_id and s.tenant_id = public.current_tenant_id())
);

drop policy if exists delivery_note_items_tenant on public.delivery_note_items;
create policy delivery_note_items_tenant on public.delivery_note_items for all using (
  exists (select 1 from public.delivery_notes d where d.id = delivery_note_id and d.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.delivery_notes d where d.id = delivery_note_id and d.tenant_id = public.current_tenant_id())
);

drop policy if exists sales_invoice_items_tenant on public.sales_invoice_items;
create policy sales_invoice_items_tenant on public.sales_invoice_items for all using (
  exists (select 1 from public.sales_invoices s where s.id = sales_invoice_id and s.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.sales_invoices s where s.id = sales_invoice_id and s.tenant_id = public.current_tenant_id())
);

drop policy if exists purchase_order_items_tenant on public.purchase_order_items;
create policy purchase_order_items_tenant on public.purchase_order_items for all using (
  exists (select 1 from public.purchase_orders p where p.id = purchase_order_id and p.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.purchase_orders p where p.id = purchase_order_id and p.tenant_id = public.current_tenant_id())
);

drop policy if exists goods_receipt_items_tenant on public.goods_receipt_items;
create policy goods_receipt_items_tenant on public.goods_receipt_items for all using (
  exists (select 1 from public.goods_receipts g where g.id = goods_receipt_id and g.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.goods_receipts g where g.id = goods_receipt_id and g.tenant_id = public.current_tenant_id())
);

drop policy if exists purchase_invoice_items_tenant on public.purchase_invoice_items;
create policy purchase_invoice_items_tenant on public.purchase_invoice_items for all using (
  exists (select 1 from public.purchase_invoices p where p.id = purchase_invoice_id and p.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.purchase_invoices p where p.id = purchase_invoice_id and p.tenant_id = public.current_tenant_id())
);

drop policy if exists stock_transfer_items_tenant on public.stock_transfer_items;
create policy stock_transfer_items_tenant on public.stock_transfer_items for all using (
  exists (select 1 from public.stock_transfers s where s.id = transfer_id and s.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.stock_transfers s where s.id = transfer_id and s.tenant_id = public.current_tenant_id())
);

drop policy if exists stock_adjustment_items_tenant on public.stock_adjustment_items;
create policy stock_adjustment_items_tenant on public.stock_adjustment_items for all using (
  exists (select 1 from public.stock_adjustments s where s.id = adjustment_id and s.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.stock_adjustments s where s.id = adjustment_id and s.tenant_id = public.current_tenant_id())
);

drop policy if exists journal_entry_lines_tenant on public.journal_entry_lines;
create policy journal_entry_lines_tenant on public.journal_entry_lines for all using (
  exists (select 1 from public.journal_entries j where j.id = journal_entry_id and j.tenant_id = public.current_tenant_id())
) with check (
  exists (select 1 from public.journal_entries j where j.id = journal_entry_id and j.tenant_id = public.current_tenant_id())
);

-- ---------- bootstrap helpers ----------
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
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
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
    (v_tenant_id, 'stock_adjustment', 'SA-', 1);

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

grant usage on schema public to anon, authenticated;
grant execute on function public.bootstrap_tenant(text, text) to authenticated;
grant execute on function public.current_tenant_id() to authenticated;
