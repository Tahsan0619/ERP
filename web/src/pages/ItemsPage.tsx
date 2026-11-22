import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Item } from '../types/database'

export function ItemsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Item[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [rate, setRate] = useState('0')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error: qError } = await supabase
      .from('items')
      .select('*')
      .order('created_at', { ascending: false })
    if (qError) setError(qError.message)
    else setRows(data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('items').insert({
      tenant_id: profile.tenant_id,
      sku: sku.trim(),
      name: name.trim(),
      valuation_rate: Number(rate) || 0,
      item_type: 'goods',
      is_stock_item: true,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setSku('')
    setName('')
    setRate('0')
    await load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Items</h1>
          <p>Product and service masters</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create item</h3>
          <div className="field">
            <label htmlFor="sku">SKU</label>
            <input id="sku" className="mono" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="rate">Valuation rate</label>
            <input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" disabled={busy} type="submit">
            {busy ? 'Saving...' : 'Save item'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.sku}</td>
                    <td>{row.name}</td>
                    <td>{row.item_type}</td>
                    <td className="num">{Number(row.valuation_rate).toFixed(2)}</td>
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
