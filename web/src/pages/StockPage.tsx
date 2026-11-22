import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { StockBalance } from '../types/database'

export function StockPage() {
  const [rows, setRows] = useState<StockBalance[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: qError } = await supabase
        .from('stock_balances')
        .select('id, qty_on_hand, qty_reserved, items(sku, name), warehouses(code, name)')
        .order('qty_on_hand', { ascending: true })
      if (qError) setError(qError.message)
      else setRows((data as unknown as StockBalance[]) ?? [])
    }
    void load()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Stock balance</h1>
          <p>On-hand and reserved quantity by warehouse</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Warehouse</th>
                <th className="num">On hand</th>
                <th className="num">Reserved</th>
                <th className="num">Available</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    No stock balances yet. Post goods receipts or adjustments to populate stock.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const available = Number(row.qty_on_hand) - Number(row.qty_reserved)
                  return (
                    <tr key={row.id}>
                      <td>{row.items?.name ?? '-'}</td>
                      <td className="mono">{row.items?.sku ?? '-'}</td>
                      <td>
                        {row.warehouses?.code} - {row.warehouses?.name}
                      </td>
                      <td className="num">{Number(row.qty_on_hand).toFixed(2)}</td>
                      <td className="num">{Number(row.qty_reserved).toFixed(2)}</td>
                      <td className="num">{available.toFixed(2)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
