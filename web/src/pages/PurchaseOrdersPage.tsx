import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { errorMessage } from '../lib/errors'
import { calcLineAmounts, type TaxTemplate } from '../lib/tax'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { AttachmentsPanel } from '../components/AttachmentsPanel'
import type { Item, PurchaseOrder, Vendor } from '../types/database'

export function PurchaseOrdersPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [rows, setRows] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [taxes, setTaxes] = useState<TaxTemplate[]>([])
  const [vendorId, setVendorId] = useState('')
  const [itemId, setItemId] = useState('')
  const [taxId, setTaxId] = useState('')
  const [qty, setQty] = useState('1')
  const [rate, setRate] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  async function load() {
    const [orders, vendorRows, itemRows, taxRows] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, tenant_id, doc_no, status, vendor_id, order_date, grand_total, vendors(name)')
        .order('created_at', { ascending: false }),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase.from('items').select('*').eq('is_active', true).order('name'),
      supabase.from('tax_templates').select('id, name, rate').order('name'),
    ])
    if (orders.error) setError(orders.error.message)
    setRows((orders.data as unknown as PurchaseOrder[]) ?? [])
    if (orders.data?.[0]) setSelectedId((prev) => prev || orders.data![0].id)
    setVendors(vendorRows.data ?? [])
    setItems(itemRows.data ?? [])
    setTaxes(taxRows.data ?? [])
    if (!vendorId && vendorRows.data?.[0]) setVendorId(vendorRows.data[0].id)
    if (!itemId && itemRows.data?.[0]) {
      setItemId(itemRows.data[0].id)
      setRate(String(itemRows.data[0].valuation_rate ?? 0))
    }
    if (!taxId && taxRows.data?.[0]) setTaxId(taxRows.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !vendorId || !itemId) return
    if (!can('purchase.create')) {
      setError('Missing purchase.create permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const qtyNum = Number(qty)
      const rateNum = Number(rate)
      const taxRate = Number(taxes.find((t) => t.id === taxId)?.rate ?? 0)
      const calc = calcLineAmounts(qtyNum, rateNum, taxRate)
      const docNo = await nextDocNo(profile.tenant_id, 'purchase_order')
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          vendor_id: vendorId,
          order_date: new Date().toISOString().slice(0, 10),
          subtotal: calc.subtotal,
          tax_amount: calc.taxAmount,
          discount_amount: 0,
          grand_total: calc.grandTotal,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (orderError) throw orderError
      const { error: itemError } = await supabase.from('purchase_order_items').insert({
        purchase_order_id: order.id,
        item_id: itemId,
        qty: qtyNum,
        rate: rateNum,
        tax_rate: calc.taxRate,
        amount: calc.subtotal,
      })
      if (itemError) throw itemError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to create purchase order'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Purchase orders</h1>
          <p>Create and track vendor purchase orders</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Quick create</h3>
          <div className="field">
            <label htmlFor="vendor">Vendor</label>
            <select id="vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
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
            disabled={busy || vendors.length === 0 || items.length === 0 || !can('purchase.create')}
            type="submit"
          >
            {busy ? 'Creating...' : 'Create draft PO'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Vendor</th>
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
                    <td>{row.vendors?.name ?? '-'}</td>
                    <td>{row.order_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                    <td>
                      <PrintLink type="purchase_order" id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedId ? <AttachmentsPanel entityType="purchase_order" entityId={selectedId} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
