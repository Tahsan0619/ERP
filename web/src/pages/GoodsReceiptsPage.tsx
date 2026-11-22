import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'

type PO = {
  id: string
  doc_no: string
  vendor_id: string
  warehouse_id: string | null
  vendors?: { name: string } | null
}

type GRN = {
  id: string
  doc_no: string
  status: string
  posting_date: string
  vendors?: { name: string } | null
}

type Warehouse = { id: string; name: string; code: string }
type POItem = { item_id: string; qty: number; received_qty: number; rate: number; items?: { sku: string; name: string } | null }

export function GoodsReceiptsPage() {
  const { profile } = useAuth()
  const [pos, setPos] = useState<PO[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [poItems, setPoItems] = useState<POItem[]>([])
  const [rows, setRows] = useState<GRN[]>([])
  const [poId, setPoId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [poRes, whRes, grnRes] = await Promise.all([
      supabase
        .from('purchase_orders')
        .select('id, doc_no, vendor_id, warehouse_id, vendors(name)')
        .in('status', ['draft', 'submitted', 'partially_received'])
        .order('created_at', { ascending: false }),
      supabase.from('warehouses').select('id, name, code').order('code'),
      supabase
        .from('goods_receipts')
        .select('id, doc_no, status, posting_date, vendors:vendor_id(name)')
        .order('created_at', { ascending: false }),
    ])
    if (poRes.error) setError(poRes.error.message)
    setPos((poRes.data as unknown as PO[]) ?? [])
    setWarehouses(whRes.data ?? [])
    setRows((grnRes.data as unknown as GRN[]) ?? [])
    if (!poId && poRes.data?.[0]) setPoId(poRes.data[0].id)
    if (!warehouseId && whRes.data?.[0]) setWarehouseId(whRes.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    async function loadItems() {
      if (!poId) return
      const { data, error: qError } = await supabase
        .from('purchase_order_items')
        .select('item_id, qty, received_qty, rate, items(sku, name)')
        .eq('purchase_order_id', poId)
      if (qError) setError(qError.message)
      setPoItems((data as unknown as POItem[]) ?? [])
      const po = pos.find((p) => p.id === poId)
      if (po?.warehouse_id) setWarehouseId(po.warehouse_id)
    }
    void loadItems()
  }, [poId, pos])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !poId || !warehouseId) return
    const openLines = poItems.filter((l) => Number(l.qty) - Number(l.received_qty) > 0)
    if (openLines.length === 0) {
      setError('No open quantities left on this PO')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const po = pos.find((p) => p.id === poId)
      if (!po) throw new Error('PO not found')
      const docNo = await nextDocNo(profile.tenant_id, 'goods_receipt')
      const { data: grn, error: grnError } = await supabase
        .from('goods_receipts')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          purchase_order_id: poId,
          vendor_id: po.vendor_id,
          warehouse_id: warehouseId,
          posting_date: new Date().toISOString().slice(0, 10),
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (grnError) throw grnError
      const lines = openLines.map((l) => ({
        goods_receipt_id: grn.id,
        item_id: l.item_id,
        qty: Number(l.qty) - Number(l.received_qty),
        rate: Number(l.rate),
      }))
      const { error: lineError } = await supabase.from('goods_receipt_items').insert(lines)
      if (lineError) throw lineError
      const { error: postError } = await supabase.rpc('post_goods_receipt', {
        p_goods_receipt_id: grn.id,
      })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post GRN')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Goods receipts</h1>
          <p>Receive against PO and post stock in</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Receive and post</h3>
          <div className="field">
            <label htmlFor="po">Purchase order</label>
            <select id="po" value={poId} onChange={(e) => setPoId(e.target.value)} required>
              {pos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.doc_no} - {p.vendors?.name}
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
                {poItems.map((l) => (
                  <tr key={l.item_id}>
                    <td>
                      {l.items?.sku} - {l.items?.name}
                    </td>
                    <td className="num">{(Number(l.qty) - Number(l.received_qty)).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" disabled={busy || pos.length === 0} type="submit">
            {busy ? 'Posting...' : 'Create and post GRN'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>GRN</th>
                  <th>Vendor</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.vendors?.name ?? '-'}</td>
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
