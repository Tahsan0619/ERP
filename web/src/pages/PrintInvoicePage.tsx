import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Invoice = {
  doc_no: string
  invoice_date: string
  grand_total: number
  subtotal: number
  tax_amount: number
  discount_amount: number
  customers?: { name: string; billing_address?: string | null } | null
}

type Line = {
  description: string | null
  qty: number
  rate: number
  amount: number
  items?: { sku: string; name: string } | null
}

export function PrintInvoicePage() {
  const { id } = useParams()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!id) return
      const [inv, items] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('doc_no, invoice_date, grand_total, subtotal, tax_amount, discount_amount, customers:customer_id(name, billing_address)')
          .eq('id', id)
          .single(),
        supabase
          .from('sales_invoice_items')
          .select('description, qty, rate, amount, items(sku, name)')
          .eq('sales_invoice_id', id),
      ])
      if (inv.error) {
        setError(inv.error.message)
        return
      }
      if (items.error) {
        setError(items.error.message)
        return
      }
      setInvoice(inv.data as unknown as Invoice)
      setLines((items.data as unknown as Line[]) ?? [])
    }
    void load()
  }, [id])

  if (error) return <div className="auth-page"><div className="alert alert-error">{error}</div></div>
  if (!invoice) return <div className="auth-page">Loading invoice...</div>

  return (
    <div style={{ background: '#fff', minHeight: '100vh', padding: 32 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 22, color: '#15202b' }}>BusinessOS</div>
            <div style={{ color: '#5b6b7c' }}>Sales Invoice</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ fontWeight: 650 }}>{invoice.doc_no}</div>
            <div>{invoice.invoice_date}</div>
          </div>
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, color: '#5b6b7c', fontWeight: 650 }}>Bill to</div>
          <div style={{ fontWeight: 650 }}>{invoice.customers?.name}</div>
          <div style={{ color: '#5b6b7c' }}>{invoice.customers?.billing_address || '-'}</div>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => (
              <tr key={idx}>
                <td>
                  {l.items?.sku} - {l.items?.name || l.description}
                </td>
                <td className="num">{Number(l.qty).toFixed(2)}</td>
                <td className="num">{Number(l.rate).toFixed(2)}</td>
                <td className="num">{Number(l.amount).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <div>Subtotal: {Number(invoice.subtotal).toFixed(2)}</div>
          <div>Tax: {Number(invoice.tax_amount).toFixed(2)}</div>
          <div>Discount: {Number(invoice.discount_amount).toFixed(2)}</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginTop: 8 }}>
            Grand total: {Number(invoice.grand_total).toFixed(2)}
          </div>
        </div>
        <button className="btn btn-primary" style={{ marginTop: 24 }} type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </div>
  )
}
