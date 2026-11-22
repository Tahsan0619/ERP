import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { calcLineAmounts, type TaxTemplate } from '../lib/tax'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { AttachmentsPanel } from '../components/AttachmentsPanel'
import type { Customer, Item, SalesOrder } from '../types/database'
import { errorMessage } from '../lib/errors'

type Warehouse = { id: string; name: string; code: string }

export function SalesOrdersPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [taxes, setTaxes] = useState<TaxTemplate[]>([])
  const [customerId, setCustomerId] = useState('')
  const [itemId, setItemId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState('')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [warehouseId, setWarehouseId] = useState('')

  async function load() {
    const [orders, customerRows, itemRows, taxRows, whRows] = await Promise.all([
      supabase
        .from('sales_orders')
        .select('id, tenant_id, doc_no, status, customer_id, order_date, grand_total, customers(name)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('items').select('*').eq('is_active', true).order('name'),
      supabase.from('tax_templates').select('id, name, rate').order('name'),
      supabase.from('warehouses').select('id, name, code').order('code'),
    ])
    if (orders.error) setError(orders.error.message)
    setRows((orders.data as unknown as SalesOrder[]) ?? [])
    if (orders.data?.[0]) setSelectedId((prev) => prev || orders.data![0].id)
    setCustomers(customerRows.data ?? [])
    setItems(itemRows.data ?? [])
    setTaxes(taxRows.data ?? [])
    if (!customerId && customerRows.data?.[0]) setCustomerId(customerRows.data[0].id)
    if (!itemId && itemRows.data?.[0]) {
      setItemId(itemRows.data[0].id)
      setRate(String(itemRows.data[0].valuation_rate ?? 0))
    }
    if (!taxId && taxRows.data?.[0]) setTaxId(taxRows.data[0].id)
    setWarehouses(whRows.data ?? [])
    if (!warehouseId && whRows.data?.[0]) setWarehouseId(whRows.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onSubmitOrder(orderId: string) {
    if (!can('sales.post')) {
      setError('Missing sales.post permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { error: updError } = await supabase
        .from('sales_orders')
        .update({ status: 'submitted' })
        .eq('id', orderId)
        .eq('status', 'draft')
      if (updError) throw updError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit order'))
    } finally {
      setBusy(false)
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !customerId || !itemId) return
    if (!can('sales.create')) {
      setError('Missing sales.create permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const qtyNum = Number(qty)
      const rateNum = Number(rate)
      const taxRate = Number(taxes.find((t) => t.id === taxId)?.rate ?? 0)
      const calc = calcLineAmounts(qtyNum, rateNum, taxRate)
      const docNo = await nextDocNo(profile.tenant_id, 'sales_order')
      const orderPayload: Record<string, unknown> = {
        tenant_id: profile.tenant_id,
        doc_no: docNo,
        status: 'draft',
        customer_id: customerId,
        order_date: new Date().toISOString().slice(0, 10),
        subtotal: calc.subtotal,
        tax_amount: calc.taxAmount,
        discount_amount: 0,
        grand_total: calc.grandTotal,
        created_by: profile.id,
      }
      if (warehouseId) orderPayload.warehouse_id = warehouseId
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .insert(orderPayload)
        .select('id')
        .single()
      if (orderError) throw orderError
      const { error: itemError } = await supabase.from('sales_order_items').insert({
        sales_order_id: order.id,
        item_id: itemId,
        qty: qtyNum,
        rate: rateNum,
        tax_rate: calc.taxRate,
        amount: calc.subtotal,
      })
      if (itemError) throw itemError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to create sales order'))
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
          <div className="field">
            <label htmlFor="wh">Ship-from warehouse</label>
            <select id="wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tax">Tax template</label>
            <select id="tax" value={taxId} onChange={(e) => setTaxId(e.target.value)}>
              {taxes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({Number(t.rate).toFixed(2)}%)
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            disabled={busy || customers.length === 0 || items.length === 0 || !can('sales.create')}
            type="submit"
          >
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
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={row.id === selectedId ? 'row-selected' : undefined}
                    onClick={() => setSelectedId(row.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.order_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td>
                      <PrintLink type="sales_order" id={row.id} />
                      {row.status === 'draft' ? (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={busy || !can('sales.post')}
                          onClick={(e) => {
                            e.stopPropagation()
                            void onSubmitOrder(row.id)
                          }}
                          style={{ marginLeft: 8 }}
                        >
                          Submit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedId ? <AttachmentsPanel entityType="sales_order" entityId={selectedId} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
