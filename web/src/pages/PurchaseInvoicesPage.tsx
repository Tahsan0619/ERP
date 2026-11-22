import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { AttachmentsPanel } from '../components/AttachmentsPanel'
import { errorMessage } from '../lib/errors'

type PO = {
  id: string
  doc_no: string
  vendor_id: string
  grand_total: number
  vendors?: { name: string } | null
}

type Invoice = {
  id: string
  doc_no: string
  status: string
  invoice_date: string
  grand_total: number
  amount_paid: number
  vendors?: { name: string } | null
}

type POItem = {
  item_id: string
  description: string | null
  qty: number
  rate: number
  tax_rate: number
  discount_amount: number
  amount: number
}

export function PurchaseInvoicesPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [orders, setOrders] = useState<PO[]>([])
  const [rows, setRows] = useState<Invoice[]>([])
  const [poId, setPoId] = useState('')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [poRes, invRes] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, doc_no, vendor_id, grand_total, vendors(name)')
        .in('status', ['draft', 'submitted', 'partially_received', 'received'])
        .order('created_at', { ascending: false }),
      supabase
        .from('purchase_invoices')
        .select('id, doc_no, status, invoice_date, grand_total, amount_paid, vendors:vendor_id(name)')
        .order('created_at', { ascending: false }),
    ])
    if (poRes.error) setError(poRes.error.message)
    setOrders((poRes.data as unknown as PO[]) ?? [])
    setRows((invRes.data as unknown as Invoice[]) ?? [])
    if (!poId && poRes.data?.[0]) setPoId(poRes.data[0].id)
    if (!selectedInvoiceId && invRes.data?.[0]) setSelectedInvoiceId((invRes.data as unknown as Invoice[])[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !poId) return
    if (!can('purchase.post')) {
      setError('Missing purchase.post permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const po = orders.find((o) => o.id === poId)
      if (!po) throw new Error('Purchase order not found')
      const { data: lines, error: lineErr } = await supabase
        .from('purchase_order_items')
        .select('item_id, description, qty, rate, tax_rate, discount_amount, amount')
        .eq('purchase_order_id', poId)
      if (lineErr) throw lineErr
      const items = (lines as POItem[]) ?? []
      if (items.length === 0) throw new Error('Purchase order has no lines')

      const subtotal = items.reduce((s, l) => s + Number(l.amount), 0)
      const taxAmount = items.reduce((s, l) => s + (Number(l.amount) * Number(l.tax_rate)) / 100, 0)
      const grandTotal = subtotal + taxAmount
      const docNo = await nextDocNo(profile.tenant_id, 'purchase_invoice')
      const { data: inv, error: invError } = await supabase
        .from('purchase_invoices')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          vendor_id: po.vendor_id,
          purchase_order_id: poId,
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

      const { error: insertLinesError } = await supabase.from('purchase_invoice_items').insert(
        items.map((l) => ({
          purchase_invoice_id: inv.id,
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

      const { error: postError } = await supabase.rpc('post_purchase_invoice', {
        p_purchase_invoice_id: inv.id,
      })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to post purchase invoice'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Purchase invoices</h1>
          <p>Bill from purchase order and post AP</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create and post bill</h3>
          <div className="field">
            <label htmlFor="po">Purchase order</label>
            <select id="po" value={poId} onChange={(e) => setPoId(e.target.value)} required>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.doc_no} - {o.vendors?.name} ({Number(o.grand_total).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || orders.length === 0 || !can('purchase.post')} type="submit">
            {busy ? 'Posting...' : 'Create and post bill'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Bill</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => setSelectedInvoiceId(row.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.vendors?.name ?? '-'}</td>
                    <td>{row.invoice_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td className="num">{Number(row.amount_paid).toFixed(2)}</td>
                    <td>
                      <PrintLink type="purchase_invoice" id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedInvoiceId ? <AttachmentsPanel entityType="purchase_invoice" entityId={selectedInvoiceId} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
