import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'

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
  const [orders, setOrders] = useState<SO[]>([])
  const [rows, setRows] = useState<Invoice[]>([])
  const [soId, setSoId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [soRes, invRes] = await Promise.all([
      supabase
        .from('sales_orders')
        .select('id, doc_no, customer_id, grand_total, customers(name)')
        .in('status', ['submitted', 'partially_delivered', 'delivered', 'draft'])
        .order('created_at', { ascending: false }),
      supabase
        .from('sales_invoices')
        .select('id, doc_no, status, invoice_date, grand_total, amount_paid, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
    ])
    if (soRes.error) setError(soRes.error.message)
    setOrders((soRes.data as unknown as SO[]) ?? [])
    setRows((invRes.data as unknown as Invoice[]) ?? [])
    if (!soId && soRes.data?.[0]) setSoId(soRes.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !soId) return
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
          tax_amount: 0,
          discount_amount: 0,
          grand_total: subtotal,
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
      setError(err instanceof Error ? err.message : 'Failed to post sales invoice')
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
          <button className="btn btn-primary" disabled={busy || orders.length === 0} type="submit">
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
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.invoice_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td className="num">{Number(row.amount_paid).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
