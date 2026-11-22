import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import type { Customer, Item } from '../types/database'

type Quotation = {
  id: string
  doc_no: string
  status: string
  quotation_date: string
  grand_total: number
  customers?: { name: string } | null
}

export function QuotationsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [customerId, setCustomerId] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [qRes, cRes, iRes] = await Promise.all([
      supabase
        .from('quotations')
        .select('id, doc_no, status, quotation_date, grand_total, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('items').select('*').eq('is_active', true).order('name'),
    ])
    if (qRes.error) setError(qRes.error.message)
    setRows((qRes.data as unknown as Quotation[]) ?? [])
    setCustomers(cRes.data ?? [])
    setItems(iRes.data ?? [])
    if (!customerId && cRes.data?.[0]) setCustomerId(cRes.data[0].id)
    if (!itemId && iRes.data?.[0]) {
      setItemId(iRes.data[0].id)
      setRate(String(iRes.data[0].valuation_rate ?? 0))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !customerId || !itemId) return
    setBusy(true)
    setError(null)
    try {
      const qtyNum = Number(qty)
      const rateNum = Number(rate)
      const amount = qtyNum * rateNum
      const docNo = await nextDocNo(profile.tenant_id, 'quotation')
      const { data: quote, error: qError } = await supabase
        .from('quotations')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'submitted',
          customer_id: customerId,
          quotation_date: new Date().toISOString().slice(0, 10),
          subtotal: amount,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: amount,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (qError) throw qError
      const { error: lineError } = await supabase.from('quotation_items').insert({
        quotation_id: quote.id,
        item_id: itemId,
        qty: qtyNum,
        rate: rateNum,
        amount,
      })
      if (lineError) throw lineError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quotation')
    } finally {
      setBusy(false)
    }
  }

  async function convertToOrder(quotationId: string) {
    if (!profile?.tenant_id) return
    setBusy(true)
    setError(null)
    try {
      const { data: quote, error: qError } = await supabase
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('id', quotationId)
        .single()
      if (qError) throw qError
      if (quote.status === 'converted') throw new Error('Already converted')

      const docNo = await nextDocNo(profile.tenant_id, 'sales_order')
      const { data: order, error: oError } = await supabase
        .from('sales_orders')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          customer_id: quote.customer_id,
          order_date: new Date().toISOString().slice(0, 10),
          quotation_id: quote.id,
          subtotal: quote.subtotal,
          tax_amount: quote.tax_amount,
          discount_amount: quote.discount_amount,
          grand_total: quote.grand_total,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (oError) throw oError

      const lines = (quote.quotation_items as Array<Record<string, unknown>>).map((l) => ({
        sales_order_id: order.id,
        item_id: l.item_id,
        description: l.description,
        qty: l.qty,
        rate: l.rate,
        tax_rate: l.tax_rate ?? 0,
        discount_amount: l.discount_amount ?? 0,
        amount: l.amount,
      }))
      const { error: lineError } = await supabase.from('sales_order_items').insert(lines)
      if (lineError) throw lineError
      const { error: updError } = await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', quotationId)
      if (updError) throw updError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to convert quotation')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Quotations</h1>
          <p>Create quotes and convert to sales orders</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create quotation</h3>
          <div className="field">
            <label htmlFor="customer">Customer</label>
            <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="item">Item</label>
            <select
              id="item"
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value)
                const found = items.find((i) => i.id === e.target.value)
                if (found) setRate(String(found.valuation_rate ?? 0))
              }}
              required
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="qty">Qty</label>
            <input id="qty" type="number" min="0.0001" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="rate">Rate</label>
            <input id="rate" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || customers.length === 0 || items.length === 0} type="submit">
            {busy ? 'Saving...' : 'Create quotation'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.quotation_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td>
                      {row.status !== 'converted' && row.status !== 'cancelled' ? (
                        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void convertToOrder(row.id)}>
                          Convert
                        </button>
                      ) : null}
                    </td>
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
