import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePermissions } from '../hooks/usePermissions'

type Tab = 'ar' | 'ap' | 'sales' | 'purchase' | 'stock' | 'tb' | 'pnl' | 'bs'

function daysBetween(from: string, to = new Date()) {
  const a = new Date(from)
  const b = to
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function bucket(days: number) {
  if (days <= 30) return '0-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(',')),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const { can } = usePermissions()
  const [tab, setTab] = useState<Tab>('ar')
  const [error, setError] = useState<string | null>(null)
  const [arRows, setArRows] = useState<Array<Record<string, unknown>>>([])
  const [apRows, setApRows] = useState<Array<Record<string, unknown>>>([])
  const [salesRows, setSalesRows] = useState<Array<Record<string, unknown>>>([])
  const [purchaseRows, setPurchaseRows] = useState<Array<Record<string, unknown>>>([])
  const [stockRows, setStockRows] = useState<Array<Record<string, unknown>>>([])
  const [tbRows, setTbRows] = useState<Array<Record<string, unknown>>>([])
  const [pnlRows, setPnlRows] = useState<Array<Record<string, unknown>>>([])
  const [bsRows, setBsRows] = useState<Array<Record<string, unknown>>>([])

  useEffect(() => {
    async function load() {
      setError(null)
      const [ar, ap, sales, purchase, stock, accounts, journals, fiscalYears] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('doc_no, invoice_date, grand_total, amount_paid, customers:customer_id(name)')
          .eq('status', 'posted'),
        supabase
          .from('purchase_invoices')
          .select('doc_no, invoice_date, grand_total, amount_paid, vendors:vendor_id(name)')
          .eq('status', 'posted'),
        supabase
          .from('sales_invoices')
          .select('doc_no, invoice_date, status, grand_total, customers:customer_id(name)')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('purchase_invoices')
          .select('doc_no, invoice_date, status, grand_total, vendors:vendor_id(name)')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('stock_balances')
          .select('qty_on_hand, qty_reserved, items(sku, name, valuation_rate), warehouses(code, name)'),
        supabase.from('accounts').select('id, code, name, account_type').eq('is_active', true).order('code'),
        supabase
          .from('journal_entries')
          .select('id, status, journal_entry_lines(account_id, debit, credit)')
          .eq('status', 'posted'),
        supabase.from('fiscal_years').select('is_closed'),
      ])

      if (ar.error || ap.error || sales.error || purchase.error || stock.error || accounts.error || journals.error) {
        setError(
          ar.error?.message ||
            ap.error?.message ||
            sales.error?.message ||
            purchase.error?.message ||
            stock.error?.message ||
            accounts.error?.message ||
            journals.error?.message ||
            'Failed to load reports',
        )
        return
      }

      setArRows(
        ((ar.data as unknown as Array<Record<string, unknown>>) ?? [])
          .map((r) => {
            const outstanding = Number(r.grand_total) - Number(r.amount_paid)
            if (outstanding <= 0) return null
            const age = daysBetween(String(r.invoice_date))
            return {
              invoice: r.doc_no,
              customer: (r.customers as { name?: string } | null)?.name ?? '-',
              date: r.invoice_date,
              outstanding: outstanding.toFixed(2),
              bucket: bucket(age),
            }
          })
          .filter(Boolean) as Array<Record<string, unknown>>,
      )

      setApRows(
        ((ap.data as unknown as Array<Record<string, unknown>>) ?? [])
          .map((r) => {
            const outstanding = Number(r.grand_total) - Number(r.amount_paid)
            if (outstanding <= 0) return null
            const age = daysBetween(String(r.invoice_date))
            return {
              bill: r.doc_no,
              vendor: (r.vendors as { name?: string } | null)?.name ?? '-',
              date: r.invoice_date,
              outstanding: outstanding.toFixed(2),
              bucket: bucket(age),
            }
          })
          .filter(Boolean) as Array<Record<string, unknown>>,
      )

      setSalesRows(
        ((sales.data as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
          invoice: r.doc_no,
          customer: (r.customers as { name?: string } | null)?.name ?? '-',
          date: r.invoice_date,
          status: r.status,
          total: Number(r.grand_total).toFixed(2),
        })),
      )

      setPurchaseRows(
        ((purchase.data as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
          bill: r.doc_no,
          vendor: (r.vendors as { name?: string } | null)?.name ?? '-',
          date: r.invoice_date,
          status: r.status,
          total: Number(r.grand_total).toFixed(2),
        })),
      )

      setStockRows(
        ((stock.data as unknown as Array<Record<string, unknown>>) ?? []).map((r) => {
          const item = r.items as { sku?: string; name?: string; valuation_rate?: number } | null
          const wh = r.warehouses as { code?: string; name?: string } | null
          const onHand = Number(r.qty_on_hand)
          const reserved = Number(r.qty_reserved)
          const rate = Number(item?.valuation_rate ?? 0)
          return {
            sku: item?.sku ?? '-',
            item: item?.name ?? '-',
            warehouse: `${wh?.code ?? '-'} ${wh?.name ?? ''}`.trim(),
            on_hand: onHand.toFixed(2),
            reserved: reserved.toFixed(2),
            available: (onHand - reserved).toFixed(2),
            value: (onHand * rate).toFixed(2),
          }
        }),
      )

      const totals = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>()
      for (const acc of accounts.data ?? []) {
        totals.set(acc.id, { code: acc.code, name: acc.name, type: acc.account_type, debit: 0, credit: 0 })
      }
      for (const je of (journals.data as unknown as Array<{ journal_entry_lines: Array<{ account_id: string; debit: number; credit: number }> }>) ?? []) {
        for (const line of je.journal_entry_lines ?? []) {
          const row = totals.get(line.account_id)
          if (!row) continue
          row.debit += Number(line.debit)
          row.credit += Number(line.credit)
        }
      }
      const tb = Array.from(totals.values())
        .filter((r) => r.debit !== 0 || r.credit !== 0)
        .map((r) => ({
          code: r.code,
          account: r.name,
          type: r.type,
          debit: r.debit.toFixed(2),
          credit: r.credit.toFixed(2),
          balance: (r.debit - r.credit).toFixed(2),
          _balanceNum: r.debit - r.credit,
          _type: r.type,
        }))
      setTbRows(tb.map(({ code, account, type, debit, credit, balance }) => ({ code, account, type, debit, credit, balance })))

      setPnlRows(
        tb
          .filter((r) => r._type === 'income' || r._type === 'expense')
          .map((r) => ({
            code: r.code,
            account: r.account,
            type: r.type,
            amount: (r._type === 'income' ? -r._balanceNum : r._balanceNum).toFixed(2),
          })),
      )

      const incomeTotal = tb.filter((r) => r._type === 'income').reduce((s, r) => s + -r._balanceNum, 0)
      const expenseTotal = tb.filter((r) => r._type === 'expense').reduce((s, r) => s + r._balanceNum, 0)
      const retainedEarnings = -incomeTotal + expenseTotal
      const hasClosedFiscalYear = (fiscalYears.data ?? []).some((fy) => fy.is_closed === true)

      const bsBase = tb
        .filter((r) => r._type === 'asset' || r._type === 'liability' || r._type === 'equity')
        .map((r) => ({
          code: r.code,
          account: r.account,
          type: r.type,
          amount: r._balanceNum.toFixed(2),
        }))

      if (!hasClosedFiscalYear && retainedEarnings !== 0) {
        bsBase.push({
          code: 'RE',
          account: 'Retained earnings (computed)',
          type: 'equity',
          amount: retainedEarnings.toFixed(2),
        })
      }

      setBsRows(bsBase)
    }
    void load()
  }, [])

  const current = useMemo(() => {
    switch (tab) {
      case 'ar':
        return arRows
      case 'ap':
        return apRows
      case 'sales':
        return salesRows
      case 'purchase':
        return purchaseRows
      case 'stock':
        return stockRows
      case 'tb':
        return tbRows
      case 'pnl':
        return pnlRows
      case 'bs':
        return bsRows
    }
  }, [tab, arRows, apRows, salesRows, purchaseRows, stockRows, tbRows, pnlRows, bsRows])

  const headers = current[0] ? Object.keys(current[0]) : []

  function onExportCsv() {
    if (!can('reports.export')) {
      setError('Missing reports.export permission')
      return
    }
    downloadCsv(`businessos-${tab}.csv`, current)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p>AR/AP aging, registers, stock, and trial balance</p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onExportCsv}
          disabled={current.length === 0 || !can('reports.export')}
        >
          Export CSV
        </button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="toolbar">
        {(
          [
            ['ar', 'AR aging'],
            ['ap', 'AP aging'],
            ['sales', 'Sales register'],
            ['purchase', 'Purchase register'],
            ['stock', 'Stock balance'],
            ['tb', 'Trial balance'],
            ['pnl', 'Profit and loss'],
            ['bs', 'Balance sheet'],
          ] as Array<[Tab, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} className={['outstanding', 'total', 'debit', 'credit', 'balance', 'value', 'on_hand', 'reserved', 'available', 'amount'].includes(h) ? 'num' : undefined}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={Math.max(headers.length, 1)}>
                    No rows for this report yet
                  </td>
                </tr>
              ) : (
                current.map((row, idx) => (
                  <tr key={idx}>
                    {headers.map((h) => (
                      <td
                        key={h}
                        className={['outstanding', 'total', 'debit', 'credit', 'balance', 'value', 'on_hand', 'reserved', 'available', 'amount'].includes(h) ? 'num' : undefined}
                      >
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
