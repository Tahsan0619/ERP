import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { AttachmentsPanel } from '../components/AttachmentsPanel'
import { errorMessage } from '../lib/errors'

type SO = {
  id: string
  doc_no: string
  customer_id: string
  grand_total: number
  customers?: { name: string } | null
}

type Invoice = {
  id: string
  doc_no: string
  status: string
  invoice_date: string
  grand_total: number
  amount_paid: number
  customers?: { name: string } | null
}

type SOItem = {
  item_id: string
  description: string | null
  qty: number
  rate: number
  tax_rate: number
  discount_amount: number
  amount: number
}

export function SalesInvoicesPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [orders, setOrders] = useState<SO[]>([])
  const [rows, setRows] = useState<Invoice[]>([])
  const [soId, setSoId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')

  async function load() {
    const dnRes = await supabase
      .from('delivery_notes')
      .select('sales_order_id')
      .eq('status', 'posted')
    const postedSoIds = [...new Set((dnRes.data ?? []).map((d) => d.sales_order_id as string))]

    let soQuery = supabase
      .from('sales_orders')
      .select('id, doc_no, customer_id, grand_total, customers(name)')
      .order('created_at', { ascending: false })
    if (postedSoIds.length > 0) {
      soQuery = soQuery.or(
        `status.in.(partially_delivered,delivered),id.in.(${postedSoIds.join(',')})`,
      )
    } else {
      soQuery = soQuery.in('status', ['partially_delivered', 'delivered'])
    }

    const [soRes, invRes] = await Promise.all([
      soQuery,
      supabase
        .from('sales_invoices')
        .select('id, doc_no, status, invoice_date, grand_total, amount_paid, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
    ])
    if (soRes.error) setError(soRes.error.message)
    if (invRes.error) setError(invRes.error.message)
    setOrders((soRes.data as unknown as SO[]) ?? [])
    setRows((invRes.data as unknown as Invoice[]) ?? [])
    if (!soId && soRes.data?.[0]) setSoId(soRes.data[0].id)
    if (invRes.data?.[0]) setSelectedInvoiceId((prev) => prev || invRes.data![0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !soId) return
    if (!can('sales.post')) {
      setError('Missing sales.post permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const so = orders.find((o) => o.id === soId)
      if (!so) throw new Error('Sales order not found')
      const { data: lines, error: lineErr } = await supabase
        .from('sales_order_items')
        .select('item_id, description, qty, rate, tax_rate, discount_amount, amount')
        .eq('sales_order_id', soId)
      if (lineErr) throw lineErr
      const items = (lines as SOItem[]) ?? []
      if (items.length === 0) throw new Error('Sales order has no lines')

      const subtotal = items.reduce((s, l) => s + Number(l.amount), 0)
      const taxAmount = items.reduce((s, l) => s + (Number(l.amount) * Number(l.tax_rate)) / 100, 0)
      const grandTotal = subtotal + taxAmount
      const docNo = await nextDocNo(profile.tenant_id, 'sales_invoice')
      const { data: inv, error: invError } = await supabase
        .from('sales_invoices')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          customer_id: so.customer_id,
          sales_order_id: soId,
          invoice_date: new Date().toISOString().slice(0, 10),
          subtotal,
          tax_amount: taxAmount,
          discount_amount: 0,
          grand_total: grandTotal,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (invError) throw invError

      const { error: insertLinesError } = await supabase.from('sales_invoice_items').insert(
        items.map((l) => ({
          sales_invoice_id: inv.id,
          item_id: l.item_id,
          description: l.description,
          qty: l.qty,
          rate: l.rate,
          tax_rate: l.tax_rate,
          discount_amount: l.discount_amount,
          amount: l.amount,
        })),
      )
      if (insertLinesError) throw insertLinesError

      const { error: postError } = await supabase.rpc('post_sales_invoice', {
        p_sales_invoice_id: inv.id,
      })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to post sales invoice'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales invoices</h1>
          <p>Invoice from sales order and post AR</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create and post invoice</h3>
          <div className="field">
            <label htmlFor="so">Sales order</label>
            <select id="so" value={soId} onChange={(e) => setSoId(e.target.value)} required>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.doc_no} - {o.customers?.name} ({Number(o.grand_total).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || orders.length === 0 || !can('sales.post')} type="submit">
            {busy ? 'Posting...' : 'Create and post invoice'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedInvoiceId ? 'row-selected' : undefined}
                    onClick={() => setSelectedInvoiceId(row.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.invoice_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td className="num">{Number(row.amount_paid).toFixed(2)}</td>
                    <td>
                      <PrintLink type="sales_invoice" id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedInvoiceId ? <AttachmentsPanel entityType="sales_invoice" entityId={selectedInvoiceId} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
