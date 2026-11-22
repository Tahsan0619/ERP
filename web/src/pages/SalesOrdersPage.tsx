import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import type { Customer, Item, SalesOrder } from '../types/database'

export function SalesOrdersPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [customerId, setCustomerId] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [orders, customerRows, itemRows] = await Promise.all([
      supabase
        .from('sales_orders')
        .select('id, tenant_id, doc_no, status, customer_id, order_date, grand_total, customers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('items').select('*').eq('is_active', true).order('name'),
    ])
    if (orders.error) setError(orders.error.message)
    setRows((orders.data as unknown as SalesOrder[]) ?? [])
    setCustomers(customerRows.data ?? [])
    setItems(itemRows.data ?? [])
    if (!customerId && customerRows.data?.[0]) setCustomerId(customerRows.data[0].id)
    if (!itemId && itemRows.data?.[0]) {
      setItemId(itemRows.data[0].id)
      setRate(String(itemRows.data[0].valuation_rate ?? 0))
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
      const docNo = await nextDocNo(profile.tenant_id, 'sales_order')
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          customer_id: customerId,
          order_date: new Date().toISOString().slice(0, 10),
          subtotal: amount,
          tax_amount: 0,
          discount_amount: 0,
          grand_total: amount,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (orderError) throw orderError
      const { error: itemError } = await supabase.from('sales_order_items').insert({
        sales_order_id: order.id,
        item_id: itemId,
        qty: qtyNum,
        rate: rateNum,
        amount,
      })
      if (itemError) throw itemError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sales order')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sales orders</h1>
          <p>Create and track customer orders</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Quick create</h3>
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
            {busy ? 'Creating...' : 'Create draft order'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.order_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
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
