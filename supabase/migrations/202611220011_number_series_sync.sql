-- Sync number_series with issued doc numbers and make next_doc_number collision-safe

create or replace function public.max_doc_suffix(p_tenant_id uuid, p_table regclass, p_prefix text)
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_max integer := 0;
  v_sql text;
begin
  v_sql := format(
    $q$
      select coalesce(max(
        nullif(regexp_replace(doc_no, '^%s', ''), '')::integer
      ), 0)
      from %s
      where tenant_id = $1 and doc_no ~ ('^' || $2 || '[0-9]+$')
    $q$,
    p_prefix,
    p_table::text
  );
  execute v_sql into v_max using p_tenant_id, p_prefix;
  return coalesce(v_max, 0);
end;
$$;

do $$
declare
  r record;
  v_max integer;
begin
  for r in
    select ns.id, ns.tenant_id, ns.doc_type, ns.prefix, ns.next_number,
      case ns.doc_type
        when 'quotation' then 'public.quotations'::regclass
        when 'sales_order' then 'public.sales_orders'::regclass
        when 'delivery_note' then 'public.delivery_notes'::regclass
        when 'sales_invoice' then 'public.sales_invoices'::regclass
        when 'credit_note' then 'public.credit_notes'::regclass
        when 'purchase_order' then 'public.purchase_orders'::regclass
        when 'goods_receipt' then 'public.goods_receipts'::regclass
        when 'purchase_invoice' then 'public.purchase_invoices'::regclass
        when 'debit_note' then 'public.debit_notes'::regclass
        when 'journal_entry' then 'public.journal_entries'::regclass
        when 'receipt_entry' then 'public.receipt_entries'::regclass
        when 'payment_entry' then 'public.payment_entries'::regclass
        when 'stock_adjustment' then 'public.stock_adjustments'::regclass
        when 'stock_transfer' then 'public.stock_transfers'::regclass
        when 'production_order' then 'public.production_orders'::regclass
        when 'payroll_run' then 'public.payroll_runs'::regclass
        else null
      end as tbl
    from public.number_series ns
  loop
    if r.tbl is null then
      continue;
    end if;
    v_max := public.max_doc_suffix(r.tenant_id, r.tbl, r.prefix);
    if v_max >= r.next_number then
      update public.number_series
      set next_number = v_max + 1
      where id = r.id;
    end if;
  end loop;
end;
$$;

create or replace function public.doc_no_exists(p_tenant_id uuid, p_doc_type text, p_doc_no text)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_exists boolean := false;
begin
  case p_doc_type
    when 'quotation' then
      select exists(select 1 from public.quotations where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'sales_order' then
      select exists(select 1 from public.sales_orders where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'delivery_note' then
      select exists(select 1 from public.delivery_notes where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'sales_invoice' then
      select exists(select 1 from public.sales_invoices where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'credit_note' then
      select exists(select 1 from public.credit_notes where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'purchase_order' then
      select exists(select 1 from public.purchase_orders where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'goods_receipt' then
      select exists(select 1 from public.goods_receipts where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'purchase_invoice' then
      select exists(select 1 from public.purchase_invoices where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'debit_note' then
      select exists(select 1 from public.debit_notes where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'journal_entry' then
      select exists(select 1 from public.journal_entries where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'receipt_entry' then
      select exists(select 1 from public.receipt_entries where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'payment_entry' then
      select exists(select 1 from public.payment_entries where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'stock_adjustment' then
      select exists(select 1 from public.stock_adjustments where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'stock_transfer' then
      select exists(select 1 from public.stock_transfers where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'production_order' then
      select exists(select 1 from public.production_orders where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    when 'payroll_run' then
      select exists(select 1 from public.payroll_runs where tenant_id = p_tenant_id and doc_no = p_doc_no) into v_exists;
    else
      v_exists := false;
  end case;
  return v_exists;
end;
$$;

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
  v_guard integer := 0;
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

  loop
    v_guard := v_guard + 1;
    if v_guard > 1000 then
      raise exception 'Could not allocate doc number for %', p_doc_type;
    end if;
    v_doc_no := v_prefix || lpad(v_next::text, 5, '0');
    exit when not public.doc_no_exists(p_tenant_id, p_doc_type, v_doc_no);
    v_next := v_next + 1;
  end loop;

  update public.number_series set next_number = v_next + 1 where id = v_series_id;
  return v_doc_no;
end;
$$;

grant execute on function public.next_doc_number(uuid, text) to authenticated;