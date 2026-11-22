import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  FileText,
  Package,
  ScrollText,
  ShoppingCart,
  TrendingUp,
  Warehouse,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { StatusChip } from '../components/StatusChip'

type Kpis = {
  salesOrders: number
  purchaseOrders: number
  stockValue: number | null
  stockItems: number
  openAr: number
}

function formatMoney(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<Kpis>({
    salesOrders: 0,
    purchaseOrders: 0,
    stockValue: null,
    stockItems: 0,
    openAr: 0,
  })
  const [recentSales, setRecentSales] = useState<
    Array<{ id: string; doc_no: string; status: string; grand_total: number; customers?: { name: string } | null }>
  >([])
  const [lowStock, setLowStock] = useState<
    Array<{ id: string; qty_on_hand: number; items?: { name: string; sku: string; reorder_level: number } | null }>
  >([])

  useEffect(() => {
    async function load() {
      const [sales, purchases, stock, arInvoices, recent, low] = await Promise.all([
        supabase.from('sales_orders').select('id', { count: 'exact', head: true }),
        supabase.from('purchase_orders').select('id', { count: 'exact', head: true }),
        supabase.from('stock_balances').select('qty_on_hand, items(valuation_rate)'),
        supabase
          .from('sales_invoices')
          .select('grand_total, amount_paid')
          .eq('status', 'posted'),
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

      let stockValue: number | null = null
      let stockItems = 0
      if (stock.data?.length) {
        stockItems = stock.data.length
        stockValue = stock.data.reduce((sum, row) => {
          const qty = Number(row.qty_on_hand)
          const item = row.items as { valuation_rate?: number } | null
          const rate = Number(item?.valuation_rate ?? 0)
          return sum + qty * rate
        }, 0)
        if (stockValue === 0 && stock.data.every((r) => !(r.items as { valuation_rate?: number } | null)?.valuation_rate)) {
          stockValue = null
        }
      }

      let openAr = 0
      if (arInvoices.data?.length) {
        openAr = arInvoices.data.reduce((sum, inv) => {
          const outstanding = Number(inv.grand_total) - Number(inv.amount_paid)
          return outstanding > 0 ? sum + outstanding : sum
        }, 0)
      }

      setKpis({
        salesOrders: sales.count ?? 0,
        purchaseOrders: purchases.count ?? 0,
        stockValue,
        stockItems,
        openAr,
      })
      setRecentSales((recent.data as unknown as typeof recentSales) ?? [])
      setLowStock((low.data as unknown as typeof lowStock) ?? [])
    }
    void load()
  }, [])

  const stockDisplay =
    kpis.stockValue != null ? `$${formatMoney(kpis.stockValue)}` : String(kpis.stockItems)

  const stockSub =
    kpis.stockValue != null
      ? `${kpis.stockItems} balance row${kpis.stockItems === 1 ? '' : 's'}`
      : 'Item balances (no valuation rates)'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Executive Dashboard</h1>
          <p>Operations and financial overview across your organization</p>
        </div>
      </div>

      <div className="quick-actions">
        <Link to="/sales/orders">
          <ShoppingCart size={16} />
          Create SO
        </Link>
        <Link to="/purchase/orders">
          <ClipboardList size={16} />
          Create PO
        </Link>
        <Link to="/finance/journals">
          <ScrollText size={16} />
          Post journal
        </Link>
        <Link to="/reports">
          <FileText size={16} />
          Reports
        </Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="label">Sales orders</div>
            <span className="kpi-icon" aria-hidden>
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="value">{kpis.salesOrders}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="label">Purchase orders</div>
            <span className="kpi-icon" aria-hidden>
              <Package size={16} />
            </span>
          </div>
          <div className="value">{kpis.purchaseOrders}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="label">Stock valuation</div>
            <span className="kpi-icon" aria-hidden>
              <Warehouse size={16} />
            </span>
          </div>
          <div className="value">{stockDisplay}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>{stockSub}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-head">
            <div className="label">Open AR</div>
            <span className="kpi-icon" aria-hidden>
              <Banknote size={16} />
            </span>
          </div>
          <div className="value">${formatMoney(kpis.openAr)}</div>
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-secondary)' }}>Unpaid posted sales invoices</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="panel">
          <PanelHeader title="Recent sales orders" subtitle="Latest customer orders in the pipeline" />
          <div className="panel-body" style={{ paddingTop: 0 }}>
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
          <PanelHeader title="Low stock" subtitle="Items with the lowest on-hand quantity" />
          <div className="panel-body" style={{ paddingTop: 0 }}>
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
                    lowStock.map((row) => {
                      const reorder = row.items?.reorder_level ?? 0
                      const low = Number(row.qty_on_hand) <= Number(reorder) && reorder > 0
                      return (
                        <tr key={row.id} className={low ? 'row-selected' : undefined}>
                          <td>{row.items?.name ?? '-'}</td>
                          <td className="mono">{row.items?.sku ?? '-'}</td>
                          <td className="num">{Number(row.qty_on_hand).toFixed(2)}</td>
                        </tr>
                      )
                    })
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

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  )
}
