import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { StatusChip } from '../components/StatusChip'

type Counts = {
  sales: number
  purchases: number
  items: number
  customers: number
}

export function DashboardPage() {
  const [counts, setCounts] = useState<Counts>({ sales: 0, purchases: 0, items: 0, customers: 0 })
  const [recentSales, setRecentSales] = useState<
    Array<{ id: string; doc_no: string; status: string; grand_total: number; customers?: { name: string } | null }>
  >([])
  const [lowStock, setLowStock] = useState<
    Array<{ id: string; qty_on_hand: number; items?: { name: string; sku: string; reorder_level: number } | null }>
  >([])

  useEffect(() => {
    async function load() {
      const [sales, purchases, items, customers, recent, stock] = await Promise.all([
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase
          .from('sales_orders')
          .select('id, doc_no, status, grand_total, customers(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('stock_balances')
          .select('id, qty_on_hand, items(name, sku, reorder_level)')
          .order('qty_on_hand', { ascending: true })
          .limit(5),
      ])

      setCounts({
        sales: sales.count ?? 0,
        purchases: purchases.count ?? 0,
        items: items.count ?? 0,
        customers: customers.count ?? 0,
      })
      setRecentSales((recent.data as unknown as typeof recentSales) ?? [])
      setLowStock((stock.data as unknown as typeof lowStock) ?? [])
    }
    void load()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Live view of sales, purchasing, stock, and masters</p>
        </div>
        <Link className="btn btn-primary" to="/sales/orders">
          Create sales order
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="label">Sales orders</div>
          <div className="value">{counts.sales}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Purchase orders</div>
          <div className="value">{counts.purchases}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Items</div>
          <div className="value">{counts.items}</div>
        </div>
        <div className="kpi-card">
          <div className="label">Customers</div>
          <div className="value">{counts.customers}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-body">
            <h3 style={{ marginTop: 0 }}>Recent sales orders</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        No sales orders yet
                      </td>
                    </tr>
                  ) : (
                    recentSales.map((row) => (
                      <tr key={row.id}>
                        <td className="mono">{row.doc_no}</td>
                        <td>{row.customers?.name ?? '-'}</td>
                        <td>
                          <StatusChip status={row.status} />
                        </td>
                        <td className="num">{Number(row.grand_total).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-body">
            <h3 style={{ marginTop: 0 }}>Stock snapshot</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>SKU</th>
                    <th className="num">On hand</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty">
                        No stock balances yet
                      </td>
                    </tr>
                  ) : (
                    lowStock.map((row) => (
                      <tr key={row.id}>
                        <td>{row.items?.name ?? '-'}</td>
                        <td className="mono">{row.items?.sku ?? '-'}</td>
                        <td className="num">{Number(row.qty_on_hand).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
