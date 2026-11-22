import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import type { Item } from '../types/database'

type Warehouse = { id: string; code: string; name: string }
type Transfer = {
  id: string
  doc_no: string
  status: string
  posting_date: string
  from_warehouse?: { code: string } | null
  to_warehouse?: { code: string } | null
}
type Adjustment = {
  id: string
  doc_no: string
  status: string
  posting_date: string
  reason: string | null
  warehouses?: { code: string } | null
}

export function StockMovesPage() {
  const { profile } = useAuth()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [fromWh, setFromWh] = useState('')
  const [toWh, setToWh] = useState('')
  const [adjWh, setAdjWh] = useState('')
  const [itemId, setItemId] = useState('')
  const [qty, setQty] = useState('1')
  const [adjQty, setAdjQty] = useState('1')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [wh, it, tr, adj] = await Promise.all([
      supabase.from('warehouses').select('id, code, name').order('code'),
      supabase.from('items').select('*').eq('is_active', true).eq('is_stock_item', true).order('name'),
      supabase
        .from('stock_transfers')
        .select('id, doc_no, status, posting_date, from_warehouse:from_warehouse_id(code), to_warehouse:to_warehouse_id(code)')
        .order('created_at', { ascending: false }),
      supabase
        .from('stock_adjustments')
        .select('id, doc_no, status, posting_date, reason, warehouses:warehouse_id(code)')
        .order('created_at', { ascending: false }),
    ])
    setWarehouses(wh.data ?? [])
    setItems(it.data ?? [])
    setTransfers((tr.data as unknown as Transfer[]) ?? [])
    setAdjustments((adj.data as unknown as Adjustment[]) ?? [])
    if (!fromWh && wh.data?.[0]) setFromWh(wh.data[0].id)
    if (!toWh && wh.data?.[1]) setToWh(wh.data[1].id)
    else if (!toWh && wh.data?.[0]) setToWh(wh.data[0].id)
    if (!adjWh && wh.data?.[0]) setAdjWh(wh.data[0].id)
    if (!itemId && it.data?.[0]) setItemId(it.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onTransfer(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !fromWh || !toWh || !itemId) return
    setBusy(true)
    setError(null)
    try {
      const docNo = await nextDocNo(profile.tenant_id, 'stock_transfer')
      const { data, error: insertError } = await supabase
        .from('stock_transfers')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          from_warehouse_id: fromWh,
          to_warehouse_id: toWh,
          posting_date: new Date().toISOString().slice(0, 10),
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: lineError } = await supabase.from('stock_transfer_items').insert({
        transfer_id: data.id,
        item_id: itemId,
        qty: Number(qty),
      })
      if (lineError) throw lineError
      const { error: postError } = await supabase.rpc('post_stock_transfer', { p_transfer_id: data.id })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed')
    } finally {
      setBusy(false)
    }
  }

  async function onAdjust(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !adjWh || !itemId) return
    setBusy(true)
    setError(null)
    try {
      const docNo = await nextDocNo(profile.tenant_id, 'stock_adjustment')
      const { data, error: insertError } = await supabase
        .from('stock_adjustments')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          warehouse_id: adjWh,
          posting_date: new Date().toISOString().slice(0, 10),
          reason: reason.trim() || null,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: lineError } = await supabase.from('stock_adjustment_items').insert({
        adjustment_id: data.id,
        item_id: itemId,
        qty_delta: Number(adjQty),
      })
      if (lineError) throw lineError
      const { error: postError } = await supabase.rpc('post_stock_adjustment', { p_adjustment_id: data.id })
      if (postError) throw postError
      setReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Adjustment failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stock moves</h1>
          <p>Transfer between warehouses and post adjustments</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onTransfer}>
          <h3 style={{ marginTop: 0 }}>Transfer</h3>
          <div className="field">
            <label htmlFor="fromWh">From warehouse</label>
            <select id="fromWh" value={fromWh} onChange={(e) => setFromWh(e.target.value)} required>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="toWh">To warehouse</label>
            <select id="toWh" value={toWh} onChange={(e) => setToWh(e.target.value)} required>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tItem">Item</label>
            <select id="tItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="tQty">Qty</label>
            <input id="tQty" type="number" min="0.0001" step="0.0001" value={qty} onChange={(e) => setQty(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || warehouses.length < 1} type="submit">
            {busy ? 'Posting...' : 'Post transfer'}
          </button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Transfer</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.doc_no}</td>
                    <td>{t.from_warehouse?.code}</td>
                    <td>{t.to_warehouse?.code}</td>
                    <td>
                      <StatusChip status={t.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={onAdjust}>
          <h3 style={{ marginTop: 0 }}>Adjustment</h3>
          <div className="field">
            <label htmlFor="adjWh">Warehouse</label>
            <select id="adjWh" value={adjWh} onChange={(e) => setAdjWh(e.target.value)} required>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.code} - {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aItem">Item</label>
            <select id="aItem" value={itemId} onChange={(e) => setItemId(e.target.value)} required>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.sku} - {i.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="aQty">Qty delta (+/-)</label>
            <input id="aQty" type="number" step="0.0001" value={adjQty} onChange={(e) => setAdjQty(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="reason">Reason</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Posting...' : 'Post adjustment'}
          </button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Adjustment</th>
                  <th>Warehouse</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((a) => (
                  <tr key={a.id}>
                    <td className="mono">{a.doc_no}</td>
                    <td>{a.warehouses?.code}</td>
                    <td>
                      <StatusChip status={a.status} />
                    </td>
                    <td>{a.reason ?? '-'}</td>
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
