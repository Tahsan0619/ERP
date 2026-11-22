import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { errorMessage } from '../lib/errors'
import { StatusChip } from '../components/StatusChip'
import type { Item } from '../types/database'

type Bom = { id: string; name: string; finished_item_id: string; items?: { name: string; sku: string } | null }
type Warehouse = { id: string; code: string; name: string }
type ProdOrder = { id: string; doc_no: string; status: string; qty: number; posting_date: string }

export function ManufacturingPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [items, setItems] = useState<Item[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [boms, setBoms] = useState<Bom[]>([])
  const [orders, setOrders] = useState<ProdOrder[]>([])
  const [bomName, setBomName] = useState('')
  const [finishedItemId, setFinishedItemId] = useState('')
  const [componentItemId, setComponentItemId] = useState('')
  const [componentQty, setComponentQty] = useState('1')
  const [bomId, setBomId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [qty, setQty] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [i, w, b, o] = await Promise.all([
      supabase.from('items').select('*').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('id, code, name').order('code'),
      supabase.from('boms').select('id, name, finished_item_id, items:finished_item_id(name, sku)').eq('is_active', true),
      supabase.from('production_orders').select('id, doc_no, status, qty, posting_date').order('created_at', { ascending: false }),
    ])
    setItems(i.data ?? [])
    setWarehouses(w.data ?? [])
    setBoms((b.data as unknown as Bom[]) ?? [])
    setOrders(o.data ?? [])
    if (!finishedItemId && i.data?.[0]) setFinishedItemId(i.data[0].id)
    if (!componentItemId && i.data?.[1]) setComponentItemId(i.data[1].id)
    if (!warehouseId && w.data?.[0]) setWarehouseId(w.data[0].id)
    if (!bomId && b.data?.[0]) setBomId((b.data as unknown as Bom[])[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreateBom(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('mfg.post')) return setError('Missing manufacturing post permission')
    setBusy(true)
    setError(null)
    try {
      const { data, error: bomError } = await supabase
        .from('boms')
        .insert({
          tenant_id: profile.tenant_id,
          name: bomName.trim(),
          finished_item_id: finishedItemId,
        })
        .select('id')
        .single()
      if (bomError) throw bomError
      const { error: lineError } = await supabase.from('bom_items').insert({
        bom_id: data.id,
        component_item_id: componentItemId,
        qty: Number(componentQty),
      })
      if (lineError) throw lineError
      setBomName('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'BOM create failed'))
    } finally {
      setBusy(false)
    }
  }

  async function onCreateOrder(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('mfg.post')) return setError('Missing manufacturing post permission')
    setBusy(true)
    setError(null)
    try {
      const docNo = await nextDocNo(profile.tenant_id, 'production_order')
      const { data, error: insertError } = await supabase
        .from('production_orders')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          bom_id: bomId,
          warehouse_id: warehouseId,
          qty: Number(qty),
          posting_date: new Date().toISOString().slice(0, 10),
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: postError } = await supabase.rpc('post_production_order', {
        p_production_order_id: data.id,
      })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Production post failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manufacturing light</h1>
          <p>BOM and production order posting (consume components, receive FG)</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreateBom}>
          <h3 style={{ marginTop: 0 }}>Create BOM</h3>
          <div className="field">
            <label htmlFor="bomName">Name</label>
            <input id="bomName" value={bomName} onChange={(e) => setBomName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="fg">Finished item</label>
            <select id="fg" value={finishedItemId} onChange={(e) => setFinishedItemId(e.target.value)} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="comp">Component</label>
            <select id="comp" value={componentItemId} onChange={(e) => setComponentItemId(e.target.value)} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cqty">Component qty per FG</label>
            <input id="cqty" type="number" min="0.0001" step="0.0001" value={componentQty} onChange={(e) => setComponentQty(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('mfg.post')} type="submit">
            Save BOM
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>BOM</th>
                  <th>Finished item</th>
                </tr>
              </thead>
              <tbody>
                {boms.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                    <td>
                      {b.items?.sku} - {b.items?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={onCreateOrder}>
          <h3 style={{ marginTop: 0 }}>Post production order</h3>
          <div className="field">
            <label htmlFor="bom">BOM</label>
            <select id="bom" value={bomId} onChange={(e) => setBomId(e.target.value)} required>
              {boms.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
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
          <div className="field">
            <label htmlFor="qty">FG qty</label>
            <input id="qty" type="number" min="0.0001" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || boms.length === 0 || !can('mfg.post')} type="submit">
            Create and post
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>MO</th>
                  <th>Date</th>
                  <th className="num">Qty</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="mono">{o.doc_no}</td>
                    <td>{o.posting_date}</td>
                    <td className="num">{Number(o.qty).toFixed(2)}</td>
                    <td>
                      <StatusChip status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  )
}
