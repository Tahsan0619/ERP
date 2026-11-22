import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'

type SO = {
  id: string
  doc_no: string
  customer_id: string
  warehouse_id: string | null
  customers?: { name: string } | null
}

type DN = {
  id: string
  doc_no: string
  status: string
  posting_date: string
  customers?: { name: string } | null
}

type Warehouse = { id: string; name: string; code: string }
type SOItem = { item_id: string; qty: number; delivered_qty: number; items?: { sku: string; name: string } | null }

export function DeliveryNotesPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<SO[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [soItems, setSoItems] = useState<SOItem[]>([])
  const [rows, setRows] = useState<DN[]>([])
  const [soId, setSoId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [soRes, whRes, dnRes] = await Promise.all([
      supabase
        .from('sales_orders')
        .select('id, doc_no, customer_id, warehouse_id, customers(name)')
        .in('status', ['draft', 'submitted', 'partially_delivered'])
        .order('created_at', { ascending: false }),
      supabase.from('warehouses').select('id, name, code').order('code'),
      supabase
        .from('delivery_notes')
        .select('id, doc_no, status, posting_date, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
    ])
    if (soRes.error) setError(soRes.error.message)
    setOrders((soRes.data as unknown as SO[]) ?? [])
    setWarehouses(whRes.data ?? [])
    setRows((dnRes.data as unknown as DN[]) ?? [])
    if (!soId && soRes.data?.[0]) setSoId(soRes.data[0].id)
    if (!warehouseId && whRes.data?.[0]) setWarehouseId(whRes.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadItems() {
      if (!soId) return
      const { data, error: qError } = await supabase
        .from('sales_order_items')
        .select('item_id, qty, delivered_qty, items(sku, name)')
        .eq('sales_order_id', soId)
      if (cancelled) return
      if (qError) setError(qError.message)
      setSoItems((data as unknown as SOItem[]) ?? [])
      const so = orders.find((o) => o.id === soId)
      if (so?.warehouse_id) setWarehouseId(so.warehouse_id)
    }
    void loadItems()
    return () => {
      cancelled = true
    }
  }, [soId, orders])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !soId || !warehouseId) return
    const openLines = soItems.filter((l) => Number(l.qty) - Number(l.delivered_qty) > 0)
    if (openLines.length === 0) {
      setError('No open quantities left on this sales order')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const so = orders.find((o) => o.id === soId)
      if (!so) throw new Error('Sales order not found')
      const docNo = await nextDocNo(profile.tenant_id, 'delivery_note')
      const { data: dn, error: dnError } = await supabase
        .from('delivery_notes')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          sales_order_id: soId,
          customer_id: so.customer_id,
          warehouse_id: warehouseId,
          posting_date: new Date().toISOString().slice(0, 10),
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (dnError) throw dnError
      const lines = openLines.map((l) => ({
        delivery_note_id: dn.id,
        item_id: l.item_id,
        qty: Number(l.qty) - Number(l.delivered_qty),
      }))
      const { error: lineError } = await supabase.from('delivery_note_items').insert(lines)
      if (lineError) throw lineError
      const { error: postError } = await supabase.rpc('post_delivery_note', {
        p_delivery_note_id: dn.id,
      })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post delivery note')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Delivery notes</h1>
          <p>Deliver against sales order and post stock out</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Deliver and post</h3>
          <div className="field">
            <label htmlFor="so">Sales order</label>
            <select id="so" value={soId} onChange={(e) => setSoId(e.target.value)} required>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.doc_no} - {o.customers?.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="wh">Warehouse</label>
            <select id="wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap" style={{ marginBottom: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Open qty</th>
                </tr>
              </thead>
              <tbody>
                {soItems.map((l) => (
                  <tr key={l.item_id}>
                    <td>
                      {l.items?.sku} - {l.items?.name}
                    </td>
                    <td className="num">{(Number(l.qty) - Number(l.delivered_qty)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" disabled={busy || orders.length === 0} type="submit">
            {busy ? 'Posting...' : 'Create and post delivery'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>DN</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.customers?.name ?? '-'}</td>
                    <td>{row.posting_date}</td>
                    <td>
                      <StatusChip status={row.status} />
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
