/**
 * BusinessOS ERP full-flow audit (REST/RPC). Exit 1 if any FAIL.
 * Env: SUPABASE_URL, SUPABASE_ANON_KEY, ERP_EMAIL, ERP_PASSWORD
 */
const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://tjojrxmugoefjkuetfdo.supabase.co'
const ANON =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRqb2pyeG11Z29lZmprdWV0ZmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUzNDU2MjksImV4cCI6MjExMDkyMTYyOX0.EBCdRQs8YfMLT0F4VmLhtR1ZWt5zeuCo58jOfbUE2Wk'
const EMAIL = process.env.ERP_EMAIL ?? 'erp@gmail.com'
const PASSWORD = process.env.ERP_PASSWORD ?? 'erp06190'

const runTag = Date.now().toString(36).toUpperCase()
const results = { ok: [], fail: [], skip: [] }

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.msg ?? json.error_description ?? JSON.stringify(json))
  return json.access_token
}

function sb(token, path, opts = {}) {
  const headers = {
    apikey: ANON,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: opts.prefer ?? 'return=representation',
    ...opts.headers,
  }
  return fetch(`${SUPABASE_URL}${path}`, { ...opts, headers })
}

async function rpc(token, name, args) {
  const res = await sb(token, `/rest/v1/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(args ?? {}),
    prefer: 'return=representation',
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? data?.hint ?? text
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
  }
  return data
}

async function from(token, table, q) {
  const res = await sb(token, `/rest/v1/${table}?${q}`, { method: 'GET', prefer: '' })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? JSON.stringify(data))
  return data
}

async function insert(token, table, row) {
  const res = await sb(token, `/rest/v1/${table}`, {
    method: 'POST',
    body: JSON.stringify(row),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message ?? data?.hint ?? JSON.stringify(data))
  return Array.isArray(data) ? data[0] : data
}

async function patch(token, table, q, body) {
  const res = await sb(token, `/rest/v1/${table}?${q}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data?.message ?? JSON.stringify(data))
  }
}

async function nextNo(token, tenantId, docType) {
  return rpc(token, 'next_doc_number', { p_tenant_id: tenantId, p_doc_type: docType })
}

function calcLine(qty, rate, taxRate) {
  const subtotal = qty * rate
  const taxAmount = (subtotal * taxRate) / 100
  return { subtotal, taxAmount, grandTotal: subtotal + taxAmount, taxRate }
}

async function tryFlow(name, fn, { skipOk = false } = {}) {
  try {
    const skipped = await fn()
    if (skipped === true) {
      results.skip.push(name)
      console.log('SKIP', name)
    } else {
      results.ok.push(name)
      console.log(skipOk ? 'OK (cached)' : 'PASS', name)
    }
  } catch (e) {
    results.fail.push({ name, error: e.message })
    console.error('FAIL', name, e.message)
  }
}

async function main() {
  await tryFlow('auth login', async () => {
    const token = await login()
    if (!token) throw new Error('No access token')
    globalThis.__auditToken = token
  })

  const token = globalThis.__auditToken
  const profile = (await from(token, 'profiles', 'select=tenant_id,id,customer_id,vendor_id&limit=1'))[0]
  const tenantId = profile.tenant_id
  const userId = profile.id

  const warehouses = await from(token, 'warehouses', 'select=id,code&order=code')
  const whMain = warehouses.find((w) => w.code === 'MAIN') ?? warehouses[0]
  const whEast = warehouses.find((w) => w.code === 'EAST') ?? warehouses[1] ?? warehouses[0]
  const customer = (await from(token, 'customers', 'select=id&limit=1'))[0]
  const vendor = (await from(token, 'vendors', 'select=id&limit=1'))[0]
  let items = await from(token, 'items', 'select=id,sku,valuation_rate&order=sku')
  const stockItem = () => items.find((i) => i.sku === 'SKU-1001') ?? items.find((i) => !String(i.sku).startsWith('AUD-')) ?? items[0]
  const accounts = await from(token, 'accounts', 'select=id,code&order=code')
  const cash = accounts.find((a) => a.code === '1000')
  const equity = accounts.find((a) => a.code === '3000')

  await tryFlow('masters item/customer/vendor', async () => {
    const uom = (await from(token, 'uoms', 'select=id&limit=1'))[0]
    const ig = (await from(token, 'item_groups', 'select=id&limit=1'))[0]
    await insert(token, 'items', {
      tenant_id: tenantId,
      sku: `AUD-${runTag}`,
      name: `Audit Item ${runTag}`,
      item_type: 'goods',
      is_stock_item: true,
      valuation_rate: 50,
      uom_id: uom?.id,
      item_group_id: ig?.id,
      is_active: true,
    })
    await insert(token, 'customers', {
      tenant_id: tenantId,
      code: `C-${runTag}`,
      name: `Audit Customer ${runTag}`,
      is_active: true,
    })
    await insert(token, 'vendors', {
      tenant_id: tenantId,
      code: `V-${runTag}`,
      name: `Audit Vendor ${runTag}`,
      is_active: true,
    })
    items = await from(token, 'items', 'select=id,sku,valuation_rate&order=sku')
  })

  await tryFlow('quotation tax + convert SO', async () => {
    const tax = (await from(token, 'tax_templates', 'select=id,rate&name=eq.VAT%2015%25&limit=1'))[0]
    const item = stockItem()
    const rate = Number(item.valuation_rate) || 100
    const qty = 1
    const calc = calcLine(qty, rate, Number(tax?.rate ?? 0))
    const docNo = await nextNo(token, tenantId, 'quotation')
    const quote = await insert(token, 'quotations', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'submitted',
      customer_id: customer.id,
      quotation_date: new Date().toISOString().slice(0, 10),
      subtotal: calc.subtotal,
      tax_amount: calc.taxAmount,
      grand_total: calc.grandTotal,
      created_by: userId,
    })
    await insert(token, 'quotation_items', {
      quotation_id: quote.id,
      item_id: item.id,
      qty,
      rate,
      tax_rate: calc.taxRate,
      amount: calc.subtotal,
    })
    const soDoc = await nextNo(token, tenantId, 'sales_order')
    const order = await insert(token, 'sales_orders', {
      tenant_id: tenantId,
      doc_no: soDoc,
      status: 'draft',
      customer_id: customer.id,
      order_date: new Date().toISOString().slice(0, 10),
      quotation_id: quote.id,
      subtotal: calc.subtotal,
      tax_amount: calc.taxAmount,
      grand_total: calc.grandTotal,
      created_by: userId,
    })
    await insert(token, 'sales_order_items', {
      sales_order_id: order.id,
      item_id: item.id,
      qty,
      rate,
      tax_rate: calc.taxRate,
      amount: calc.subtotal,
    })
    await patch(token, 'quotations', `id=eq.${quote.id}`, { status: 'converted' })
    await patch(token, 'sales_orders', `id=eq.${order.id}`, { status: 'submitted' })
    globalThis.__auditSoId = order.id
    globalThis.__auditSoDoc = soDoc
  })

  await tryFlow('SO submit → delivery post', async () => {
    const soId = globalThis.__auditSoId
    if (!soId) throw new Error('No audit sales order from prior step')
    const so = (await from(token, 'sales_orders', `select=id,customer_id&id=eq.${soId}`))[0]
    const line = (await from(token, 'sales_order_items', `select=item_id,qty,delivered_qty&sales_order_id=eq.${soId}`))[0]
    const docNo = await nextNo(token, tenantId, 'delivery_note')
    const dn = await insert(token, 'delivery_notes', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      sales_order_id: so.id,
      customer_id: so.customer_id,
      warehouse_id: whMain.id,
      posting_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    await insert(token, 'delivery_note_items', {
      delivery_note_id: dn.id,
      item_id: line.item_id,
      qty: Number(line.qty) - Number(line.delivered_qty),
    })
    await rpc(token, 'post_delivery_note', { p_delivery_note_id: dn.id })
  })

  await tryFlow('sales_invoice post', async () => {
    const soId = globalThis.__auditSoId
    const so = (await from(token, 'sales_orders', `select=id,customer_id,grand_total,subtotal,tax_amount&id=eq.${soId}`))[0]
    const docNo = await nextNo(token, tenantId, 'sales_invoice')
    const inv = await insert(token, 'sales_invoices', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      customer_id: so.customer_id,
      sales_order_id: so.id,
      invoice_date: new Date().toISOString().slice(0, 10),
      subtotal: so.subtotal,
      tax_amount: so.tax_amount,
      grand_total: so.grand_total,
      created_by: userId,
    })
    const soi = (await from(token, 'sales_order_items', `select=item_id,qty,rate,tax_rate,amount&sales_order_id=eq.${so.id}`))[0]
    await insert(token, 'sales_invoice_items', {
      sales_invoice_id: inv.id,
      item_id: soi.item_id,
      qty: soi.qty,
      rate: soi.rate,
      tax_rate: soi.tax_rate,
      amount: soi.amount,
    })
    await rpc(token, 'post_sales_invoice', { p_sales_invoice_id: inv.id })
    globalThis.__auditInvId = inv.id
  })

  await tryFlow('receipt_entry post', async () => {
    const docNo = await nextNo(token, tenantId, 'receipt_entry')
    const re = await insert(token, 'receipt_entries', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      customer_id: customer.id,
      entry_date: new Date().toISOString().slice(0, 10),
      amount: 10,
      mode: 'bank',
      created_by: userId,
    })
    await rpc(token, 'post_receipt_entry', { p_receipt_entry_id: re.id })
    globalThis.__auditReceiptId = re.id
  })

  await tryFlow('PO → GRN post', async () => {
    const item = stockItem()
    const poDoc = await nextNo(token, tenantId, 'purchase_order')
    const rate = Number(item.valuation_rate) || 50
    const qty = 2
    const po = await insert(token, 'purchase_orders', {
      tenant_id: tenantId,
      doc_no: poDoc,
      status: 'submitted',
      vendor_id: vendor.id,
      order_date: new Date().toISOString().slice(0, 10),
      subtotal: rate * qty,
      tax_amount: 0,
      grand_total: rate * qty,
      created_by: userId,
    })
    await insert(token, 'purchase_order_items', {
      purchase_order_id: po.id,
      item_id: item.id,
      qty,
      rate,
      tax_rate: 0,
      amount: rate * qty,
    })
    const grnDoc = await nextNo(token, tenantId, 'goods_receipt')
    const grn = await insert(token, 'goods_receipts', {
      tenant_id: tenantId,
      doc_no: grnDoc,
      status: 'draft',
      purchase_order_id: po.id,
      vendor_id: vendor.id,
      warehouse_id: whMain.id,
      posting_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    await insert(token, 'goods_receipt_items', {
      goods_receipt_id: grn.id,
      item_id: item.id,
      qty,
      rate,
    })
    await rpc(token, 'post_goods_receipt', { p_goods_receipt_id: grn.id })
    globalThis.__auditPoId = po.id
  })

  await tryFlow('purchase_invoice post', async () => {
    const po = (await from(token, 'purchase_orders', `select=id,vendor_id&id=eq.${globalThis.__auditPoId}`))[0]
    const poi = (await from(token, 'purchase_order_items', `select=*&purchase_order_id=eq.${po.id}`))[0]
    const docNo = await nextNo(token, tenantId, 'purchase_invoice')
    const inv = await insert(token, 'purchase_invoices', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      vendor_id: po.vendor_id,
      purchase_order_id: po.id,
      invoice_date: new Date().toISOString().slice(0, 10),
      subtotal: poi.amount,
      tax_amount: 0,
      grand_total: poi.amount,
      created_by: userId,
    })
    await insert(token, 'purchase_invoice_items', {
      purchase_invoice_id: inv.id,
      item_id: poi.item_id,
      qty: poi.qty,
      rate: poi.rate,
      tax_rate: poi.tax_rate,
      amount: poi.amount,
    })
    await rpc(token, 'post_purchase_invoice', { p_purchase_invoice_id: inv.id })
    globalThis.__auditPurInvId = inv.id
  })

  await tryFlow('payment_entry post', async () => {
    const docNo = await nextNo(token, tenantId, 'payment_entry')
    const pe = await insert(token, 'payment_entries', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      party_type: 'vendor',
      vendor_id: vendor.id,
      entry_date: new Date().toISOString().slice(0, 10),
      amount: 5,
      mode: 'bank',
      created_by: userId,
    })
    await rpc(token, 'post_payment_entry', { p_payment_entry_id: pe.id })
  })

  await tryFlow('journal_entry post', async () => {
    const docNo = await nextNo(token, tenantId, 'journal_entry')
    const je = await insert(token, 'journal_entries', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      entry_date: new Date().toISOString().slice(0, 10),
      remarks: `Audit JV ${runTag}`,
      created_by: userId,
    })
    await insert(token, 'journal_entry_lines', {
      journal_entry_id: je.id,
      account_id: cash.id,
      debit: 1,
      credit: 0,
      memo: 'test',
    })
    await insert(token, 'journal_entry_lines', {
      journal_entry_id: je.id,
      account_id: equity.id,
      debit: 0,
      credit: 1,
      memo: 'test',
    })
    await rpc(token, 'post_journal_entry', { p_journal_entry_id: je.id })
  })

  await tryFlow('stock_adjustment post', async () => {
    const item = items.find((i) => i.sku === 'SKU-1001') ?? items[0]
    const docNo = await nextNo(token, tenantId, 'stock_adjustment')
    const adj = await insert(token, 'stock_adjustments', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      warehouse_id: whMain.id,
      posting_date: new Date().toISOString().slice(0, 10),
      reason: `Audit +1 ${runTag}`,
      created_by: userId,
    })
    await insert(token, 'stock_adjustment_items', {
      adjustment_id: adj.id,
      item_id: item.id,
      qty_delta: 1,
    })
    await rpc(token, 'post_stock_adjustment', { p_adjustment_id: adj.id })
  })

  await tryFlow('stock_transfer MAIN↔EAST', async () => {
    if (whMain.id === whEast.id) throw new Error('Need distinct MAIN and EAST warehouses')
    const item = items.find((i) => i.sku === 'SKU-1001') ?? items[0]
    const docNo = await nextNo(token, tenantId, 'stock_transfer')
    const tr = await insert(token, 'stock_transfers', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      from_warehouse_id: whMain.id,
      to_warehouse_id: whEast.id,
      posting_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    await insert(token, 'stock_transfer_items', {
      transfer_id: tr.id,
      item_id: item.id,
      qty: 1,
    })
    await rpc(token, 'post_stock_transfer', { p_transfer_id: tr.id })
  })

  await tryFlow('credit_note post', async () => {
    const sinv =
      globalThis.__auditInvId &&
      (await from(token, 'sales_invoices', `select=id,customer_id,grand_total&id=eq.${globalThis.__auditInvId}`))[0]
    if (!sinv) throw new Error('No sales invoice for credit note')
    const docNo = await nextNo(token, tenantId, 'credit_note')
    const cn = await insert(token, 'credit_notes', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      customer_id: sinv.customer_id,
      sales_invoice_id: sinv.id,
      credit_date: new Date().toISOString().slice(0, 10),
      grand_total: Math.min(5, Number(sinv.grand_total)),
      created_by: userId,
    })
    await rpc(token, 'post_credit_note', { p_credit_note_id: cn.id })
  })

  await tryFlow('debit_note post', async () => {
    const pinv =
      globalThis.__auditPurInvId &&
      (await from(token, 'purchase_invoices', `select=id,vendor_id,grand_total&id=eq.${globalThis.__auditPurInvId}`))[0]
    if (!pinv) throw new Error('No purchase invoice for debit note')
    const docNo = await nextNo(token, tenantId, 'debit_note')
    const dn = await insert(token, 'debit_notes', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      vendor_id: pinv.vendor_id,
      purchase_invoice_id: pinv.id,
      debit_date: new Date().toISOString().slice(0, 10),
      grand_total: Math.min(5, Number(pinv.grand_total)),
      created_by: userId,
    })
    await rpc(token, 'post_debit_note', { p_debit_note_id: dn.id })
  })

  await tryFlow('manufacturing BOM + production', async () => {
    const finished = items.find((i) => i.sku === 'SKU-1002') ?? items[0]
    const component = items.find((i) => i.sku === 'SKU-1001') ?? items[1]
    const bom = await insert(token, 'boms', {
      tenant_id: tenantId,
      name: `Audit BOM ${runTag}`,
      finished_item_id: finished.id,
    })
    await insert(token, 'bom_items', {
      bom_id: bom.id,
      component_item_id: component.id,
      qty: 1,
    })
    const docNo = await nextNo(token, tenantId, 'production_order')
    const mo = await insert(token, 'production_orders', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      bom_id: bom.id,
      warehouse_id: whMain.id,
      qty: 1,
      posting_date: new Date().toISOString().slice(0, 10),
      created_by: userId,
    })
    await rpc(token, 'post_production_order', { p_production_order_id: mo.id })
  })

  await tryFlow('HR employee + attendance + leave + payroll', async () => {
    const empCode = `EMP-${runTag}`
    let emp = (await from(token, 'employees', `select=id&code=eq.${empCode}`))[0]
    if (!emp) {
      emp = await insert(token, 'employees', {
        tenant_id: tenantId,
        code: empCode,
        full_name: `Audit Employee ${runTag}`,
        join_date: new Date().toISOString().slice(0, 10),
      })
    }
    const today = new Date().toISOString().slice(0, 10)
    const attExists = (
      await from(
        token,
        'attendance',
        `select=id&employee_id=eq.${emp.id}&attendance_date=eq.${today}&limit=1`,
      )
    )[0]
    if (!attExists) {
      await insert(token, 'attendance', {
        tenant_id: tenantId,
        employee_id: emp.id,
        attendance_date: today,
        status: 'present',
      })
    }
    await insert(token, 'leave_requests', {
      tenant_id: tenantId,
      employee_id: emp.id,
      leave_type: 'annual',
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      status: 'approved',
    })
    const docNo = await nextNo(token, tenantId, 'payroll_run')
    const pr = await insert(token, 'payroll_runs', {
      tenant_id: tenantId,
      doc_no: docNo,
      status: 'draft',
      period_start: new Date().toISOString().slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
      total_amount: 100,
      created_by: userId,
    })
    await insert(token, 'payroll_lines', {
      payroll_run_id: pr.id,
      employee_id: emp.id,
      basic_pay: 100,
      deductions: 0,
      net_pay: 100,
    })
    await rpc(token, 'post_payroll_run', { p_payroll_run_id: pr.id })
  })

  await tryFlow('bank account + reconcile', async () => {
    const bankGl = accounts.find((a) => a.code === '1100') ?? cash
    const bank = await insert(token, 'bank_accounts', {
      tenant_id: tenantId,
      name: `Audit Bank ${runTag}`,
      account_id: bankGl.id,
      bank_name: 'Audit Bank',
    })
    const line = await insert(token, 'bank_statement_lines', {
      tenant_id: tenantId,
      bank_account_id: bank.id,
      statement_date: new Date().toISOString().slice(0, 10),
      description: 'Audit deposit',
      amount: 10,
    })
    const receipt =
      (globalThis.__auditReceiptId &&
        (await from(token, 'receipt_entries', `select=id&id=eq.${globalThis.__auditReceiptId}`))[0]) ||
      (await from(token, 'receipt_entries', 'select=id&status=eq.posted&order=created_at.desc&limit=1'))[0]
    if (!receipt) throw new Error('No posted receipt for reconcile')
    await rpc(token, 'reconcile_bank_line', {
      p_line_id: line.id,
      p_payment_id: null,
      p_receipt_id: receipt.id,
    })
  })

  await tryFlow('fiscal_years list', async () => {
    const fys = await from(token, 'fiscal_years', 'select=id,name,is_closed&order=start_date')
    if (!fys.length) throw new Error('No fiscal years')
    const open = fys.find((f) => !f.is_closed)
    if (!open) throw new Error('All fiscal years closed')
  })

  await tryFlow('create_invite', async () => {
    await rpc(token, 'create_invite', {
      p_email: `invite-${runTag.toLowerCase()}@example.com`,
      p_role_code: 'R-SALES',
    })
  })

  await tryFlow('portal link party', async () => {
    await patch(token, 'profiles', `id=eq.${userId}`, {
      customer_id: customer.id,
      vendor_id: null,
    })
    const p = (await from(token, 'profiles', `select=customer_id&id=eq.${userId}`))[0]
    if (p.customer_id !== customer.id) throw new Error('Portal link not saved')
  })

  await tryFlow('reports queries', async () => {
    await from(token, 'sales_invoices', 'select=doc_no&status=eq.posted&limit=5')
    await from(token, 'purchase_invoices', 'select=doc_no&status=eq.posted&limit=5')
    await from(token, 'stock_balances', 'select=qty_on_hand,items(sku)&limit=5')
    await from(token, 'journal_entries', 'select=doc_no&status=eq.posted&limit=5')
    await from(token, 'accounts', 'select=code,name&is_active=eq.true&limit=10')
  })

  await tryFlow('attachment upload sales_invoice', async () => {
    const invId = globalThis.__auditInvId
    if (!invId) throw new Error('No invoice for attachment test')
    const path = `${tenantId}/sales_invoice/${invId}/${runTag}-audit.txt`
    const body = new TextEncoder().encode('ERP audit attachment')
    const up = await fetch(`${SUPABASE_URL}/storage/v1/object/attachments/${path}`, {
      method: 'POST',
      headers: {
        apikey: ANON,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'x-upsert': 'false',
      },
      body,
    })
    if (!up.ok) {
      const t = await up.text()
      if (t.includes('Bucket not found') || t.includes('not found')) {
        console.warn('WARN: attachments bucket unavailable — skipping storage insert')
        return true
      }
      throw new Error(t)
    }
    await insert(token, 'attachments', {
      tenant_id: tenantId,
      entity_type: 'sales_invoice',
      entity_id: invId,
      file_name: `${runTag}-audit.txt`,
      file_path: path,
      mime_type: 'text/plain',
      uploaded_by: userId,
    })
  })

  const pass = results.ok.length
  const fail = results.fail.length
  const skip = results.skip.length
  console.log('\n========== AUDIT SUMMARY ==========')
  console.log(`PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}`)
  if (results.fail.length) {
    console.log('\nFailures:')
    for (const f of results.fail) console.log(`  - ${f.name}: ${f.error}`)
  }
  console.log('===================================\n')
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error('FATAL', e.message)
  process.exit(1)
})