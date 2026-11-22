import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'

type DocType =
  | 'invoice'
  | 'sales_invoice'
  | 'purchase_invoice'
  | 'quotation'
  | 'sales_order'
  | 'purchase_order'
  | 'delivery_note'
  | 'goods_receipt'
  | 'credit_note'
  | 'debit_note'
  | 'receipt'
  | 'payment'
  | 'journal'

type Header = {
  title: string
  docNo: string
  date: string
  partyLabel: string
  partyName: string
  partyAddress?: string
  status?: string
  subtotal?: number
  taxAmount?: number
  discountAmount?: number
  grandTotal?: number
  remarks?: string
}

type Line = {
  label: string
  qty?: number
  rate?: number
  amount?: number
  debit?: number
  credit?: number
}

const TYPE_ALIASES: Record<string, DocType> = {
  invoice: 'sales_invoice',
  sales_invoice: 'sales_invoice',
  purchase_invoice: 'purchase_invoice',
  quotation: 'quotation',
  sales_order: 'sales_order',
  purchase_order: 'purchase_order',
  delivery_note: 'delivery_note',
  goods_receipt: 'goods_receipt',
  credit_note: 'credit_note',
  debit_note: 'debit_note',
  receipt: 'receipt',
  payment: 'payment',
  journal: 'journal',
}

export function PrintDocPage() {
  const { type = 'invoice', id } = useParams()
  const docType = TYPE_ALIASES[type] ?? null
  const [header, setHeader] = useState<Header | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!id || !docType) {
        setError('Unknown document type')
        return
      }
      setError(null)
      try {
        const loaded = await loadDocument(docType, id)
        setHeader(loaded.header)
        setLines(loaded.lines)
      } catch (err) {
        setError(errorMessage(err, 'Failed to load document'))
      }
    }
    void load()
  }, [docType, id])

  if (error) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="alert alert-error">{error}</div>
          <Link className="btn btn-secondary" to="/">
            Back
          </Link>
        </div>
      </div>
    )
  }

  if (!header) {
    return (
      <div className="auth-page">
        <div className="auth-card">Loading document...</div>
      </div>
    )
  }

  const showMoneyCols = lines.some((l) => l.rate != null || l.amount != null)
  const showJournalCols = lines.some((l) => l.debit != null || l.credit != null)

  return (
    <div className="print-page">
      <div className="print-sheet">
        <div className="print-toolbar no-print">
          <Link className="btn btn-secondary" to={backPath(docType)}>
            Back
          </Link>
          <button className="btn btn-primary" type="button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>

        <header className="print-header">
          <div>
            <div className="print-brand">BusinessOS</div>
            <div className="print-doc-title">{header.title}</div>
          </div>
          <div className="print-meta">
            <div className="mono">{header.docNo}</div>
            <div>{header.date}</div>
            {header.status ? <div className="print-status">{header.status}</div> : null}
          </div>
        </header>

        <section className="print-party">
          <div className="print-label">{header.partyLabel}</div>
          <div className="print-party-name">{header.partyName}</div>
          {header.partyAddress ? <div className="print-muted">{header.partyAddress}</div> : null}
        </section>

        <table className="data print-table">
          <thead>
            <tr>
              <th>{showJournalCols ? 'Account' : 'Item / description'}</th>
              {showJournalCols ? (
                <>
                  <th className="num">Debit</th>
                  <th className="num">Credit</th>
                </>
              ) : showMoneyCols ? (
                <>
                  <th className="num">Qty</th>
                  <th className="num">Rate</th>
                  <th className="num">Amount</th>
                </>
              ) : (
                <th className="num">Qty</th>
              )}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty">
                  No lines
                </td>
              </tr>
            ) : (
              lines.map((l, idx) => (
                <tr key={idx}>
                  <td>{l.label}</td>
                  {showJournalCols ? (
                    <>
                      <td className="num">{Number(l.debit ?? 0).toFixed(2)}</td>
                      <td className="num">{Number(l.credit ?? 0).toFixed(2)}</td>
                    </>
                  ) : showMoneyCols ? (
                    <>
                      <td className="num">{l.qty != null ? Number(l.qty).toFixed(2) : '-'}</td>
                      <td className="num">{l.rate != null ? Number(l.rate).toFixed(2) : '-'}</td>
                      <td className="num">{l.amount != null ? Number(l.amount).toFixed(2) : '-'}</td>
                    </>
                  ) : (
                    <td className="num">{l.qty != null ? Number(l.qty).toFixed(2) : '-'}</td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {header.grandTotal != null ? (
          <div className="print-totals">
            {header.subtotal != null ? <div>Subtotal: {Number(header.subtotal).toFixed(2)}</div> : null}
            {header.taxAmount != null ? <div>Tax: {Number(header.taxAmount).toFixed(2)}</div> : null}
            {header.discountAmount != null ? <div>Discount: {Number(header.discountAmount).toFixed(2)}</div> : null}
            <div className="print-grand">Grand total: {Number(header.grandTotal).toFixed(2)}</div>
          </div>
        ) : null}

        {header.remarks ? <p className="print-muted">Remarks: {header.remarks}</p> : null}

        <p className="print-hint no-print">
          Tip: click <strong>Print / Save as PDF</strong>, then choose “Save as PDF” or “Microsoft Print to PDF” in the
          print dialog.
        </p>
      </div>
    </div>
  )
}

function backPath(type: DocType | null) {
  switch (type) {
    case 'sales_invoice':
      return '/sales/invoices'
    case 'purchase_invoice':
      return '/purchase/invoices'
    case 'quotation':
      return '/sales/quotations'
    case 'sales_order':
      return '/sales/orders'
    case 'purchase_order':
      return '/purchase/orders'
    case 'delivery_note':
      return '/sales/deliveries'
    case 'goods_receipt':
      return '/purchase/receipts'
    case 'credit_note':
    case 'debit_note':
      return '/sales/notes'
    case 'receipt':
    case 'payment':
      return '/finance/cash'
    case 'journal':
      return '/finance/journals'
    default:
      return '/'
  }
}

async function loadDocument(type: DocType, id: string): Promise<{ header: Header; lines: Line[] }> {
  switch (type) {
    case 'sales_invoice': {
      const [inv, items] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select(
            'doc_no, invoice_date, status, grand_total, subtotal, tax_amount, discount_amount, customers:customer_id(name, billing_address)',
          )
          .eq('id', id)
          .single(),
        supabase
          .from('sales_invoice_items')
          .select('description, qty, rate, amount, items(sku, name)')
          .eq('sales_invoice_id', id),
      ])
      if (inv.error) throw inv.error
      if (items.error) throw items.error
      const row = inv.data as unknown as {
        doc_no: string
        invoice_date: string
        status: string
        grand_total: number
        subtotal: number
        tax_amount: number
        discount_amount: number
        customers?: { name: string; billing_address?: string | null } | null
      }
      return {
        header: {
          title: 'Sales Invoice',
          docNo: row.doc_no,
          date: row.invoice_date,
          status: row.status,
          partyLabel: 'Bill to',
          partyName: row.customers?.name ?? '-',
          partyAddress: row.customers?.billing_address ?? undefined,
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          discountAmount: row.discount_amount,
          grandTotal: row.grand_total,
        },
        lines: ((items.data as unknown as Array<{
          description: string | null
          qty: number
          rate: number
          amount: number
          items?: { sku: string; name: string } | null
        }>) ?? []).map((l) => ({
          label: `${l.items?.sku ?? ''} - ${l.items?.name || l.description || 'Item'}`.replace(/^\s-\s/, ''),
          qty: l.qty,
          rate: l.rate,
          amount: l.amount,
        })),
      }
    }
    case 'purchase_invoice': {
      const [inv, items] = await Promise.all([
        supabase
          .from('purchase_invoices')
          .select(
            'doc_no, invoice_date, status, grand_total, subtotal, tax_amount, discount_amount, vendors:vendor_id(name)',
          )
          .eq('id', id)
          .single(),
        supabase
          .from('purchase_invoice_items')
          .select('description, qty, rate, amount, items(sku, name)')
          .eq('purchase_invoice_id', id),
      ])
      if (inv.error) throw inv.error
      if (items.error) throw items.error
      const row = inv.data as unknown as {
        doc_no: string
        invoice_date: string
        status: string
        grand_total: number
        subtotal: number
        tax_amount: number
        discount_amount: number
        vendors?: { name: string } | null
      }
      return {
        header: {
          title: 'Purchase Invoice / Bill',
          docNo: row.doc_no,
          date: row.invoice_date,
          status: row.status,
          partyLabel: 'Vendor',
          partyName: row.vendors?.name ?? '-',
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          discountAmount: row.discount_amount,
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'quotation': {
      const [doc, items] = await Promise.all([
        supabase
          .from('quotations')
          .select('doc_no, quotation_date, status, grand_total, subtotal, tax_amount, discount_amount, customers:customer_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('quotation_items').select('description, qty, rate, amount, items(sku, name)').eq('quotation_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        quotation_date: string
        status: string
        grand_total: number
        subtotal: number
        tax_amount: number
        discount_amount: number
        customers?: { name: string } | null
      }
      return {
        header: {
          title: 'Quotation',
          docNo: row.doc_no,
          date: row.quotation_date,
          status: row.status,
          partyLabel: 'Customer',
          partyName: row.customers?.name ?? '-',
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          discountAmount: row.discount_amount,
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'sales_order': {
      const [doc, items] = await Promise.all([
        supabase
          .from('sales_orders')
          .select('doc_no, order_date, status, grand_total, subtotal, tax_amount, discount_amount, customers:customer_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('sales_order_items').select('description, qty, rate, amount, items(sku, name)').eq('sales_order_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        order_date: string
        status: string
        grand_total: number
        subtotal: number
        tax_amount: number
        discount_amount: number
        customers?: { name: string } | null
      }
      return {
        header: {
          title: 'Sales Order',
          docNo: row.doc_no,
          date: row.order_date,
          status: row.status,
          partyLabel: 'Customer',
          partyName: row.customers?.name ?? '-',
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          discountAmount: row.discount_amount,
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'purchase_order': {
      const [doc, items] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('doc_no, order_date, status, grand_total, subtotal, tax_amount, discount_amount, vendors:vendor_id(name)')
          .eq('id', id)
          .single(),
        supabase
          .from('purchase_order_items')
          .select('description, qty, rate, amount, items(sku, name)')
          .eq('purchase_order_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        order_date: string
        status: string
        grand_total: number
        subtotal: number
        tax_amount: number
        discount_amount: number
        vendors?: { name: string } | null
      }
      return {
        header: {
          title: 'Purchase Order',
          docNo: row.doc_no,
          date: row.order_date,
          status: row.status,
          partyLabel: 'Vendor',
          partyName: row.vendors?.name ?? '-',
          subtotal: row.subtotal,
          taxAmount: row.tax_amount,
          discountAmount: row.discount_amount,
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'delivery_note': {
      const [doc, items] = await Promise.all([
        supabase
          .from('delivery_notes')
          .select('doc_no, posting_date, status, customers:customer_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('delivery_note_items').select('qty, items(sku, name)').eq('delivery_note_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        posting_date: string
        status: string
        customers?: { name: string } | null
      }
      return {
        header: {
          title: 'Delivery Note',
          docNo: row.doc_no,
          date: row.posting_date,
          status: row.status,
          partyLabel: 'Customer',
          partyName: row.customers?.name ?? '-',
        },
        lines: ((items.data as unknown as Array<{ qty: number; items?: { sku: string; name: string } | null }>) ?? []).map(
          (l) => ({
            label: `${l.items?.sku ?? ''} - ${l.items?.name ?? 'Item'}`.replace(/^\s-\s/, ''),
            qty: l.qty,
          }),
        ),
      }
    }
    case 'goods_receipt': {
      const [doc, items] = await Promise.all([
        supabase
          .from('goods_receipts')
          .select('doc_no, posting_date, status, vendors:vendor_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('goods_receipt_items').select('qty, items(sku, name)').eq('goods_receipt_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        posting_date: string
        status: string
        vendors?: { name: string } | null
      }
      return {
        header: {
          title: 'Goods Receipt Note',
          docNo: row.doc_no,
          date: row.posting_date,
          status: row.status,
          partyLabel: 'Vendor',
          partyName: row.vendors?.name ?? '-',
        },
        lines: ((items.data as unknown as Array<{ qty: number; items?: { sku: string; name: string } | null }>) ?? []).map(
          (l) => ({
            label: `${l.items?.sku ?? ''} - ${l.items?.name ?? 'Item'}`.replace(/^\s-\s/, ''),
            qty: l.qty,
          }),
        ),
      }
    }
    case 'credit_note': {
      const [doc, items] = await Promise.all([
        supabase
          .from('credit_notes')
          .select('doc_no, credit_date, status, grand_total, customers:customer_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('credit_note_items').select('description, qty, rate, amount, items(sku, name)').eq('credit_note_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        credit_date: string
        status: string
        grand_total: number
        customers?: { name: string } | null
      }
      return {
        header: {
          title: 'Credit Note',
          docNo: row.doc_no,
          date: row.credit_date,
          status: row.status,
          partyLabel: 'Customer',
          partyName: row.customers?.name ?? '-',
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'debit_note': {
      const [doc, items] = await Promise.all([
        supabase
          .from('debit_notes')
          .select('doc_no, debit_date, status, grand_total, vendors:vendor_id(name)')
          .eq('id', id)
          .single(),
        supabase.from('debit_note_items').select('description, qty, rate, amount, items(sku, name)').eq('debit_note_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        debit_date: string
        status: string
        grand_total: number
        vendors?: { name: string } | null
      }
      return {
        header: {
          title: 'Debit Note',
          docNo: row.doc_no,
          date: row.debit_date,
          status: row.status,
          partyLabel: 'Vendor',
          partyName: row.vendors?.name ?? '-',
          grandTotal: row.grand_total,
        },
        lines: mapItemLines(items.data),
      }
    }
    case 'receipt': {
      const doc = await supabase
        .from('receipt_entries')
        .select('doc_no, entry_date, status, amount, remarks, customers:customer_id(name)')
        .eq('id', id)
        .single()
      if (doc.error) throw doc.error
      const row = doc.data as unknown as {
        doc_no: string
        entry_date: string
        status: string
        amount: number
        remarks: string | null
        customers?: { name: string } | null
      }
      return {
        header: {
          title: 'Customer Receipt',
          docNo: row.doc_no,
          date: row.entry_date,
          status: row.status,
          partyLabel: 'Customer',
          partyName: row.customers?.name ?? '-',
          grandTotal: row.amount,
          remarks: row.remarks ?? undefined,
        },
        lines: [{ label: 'Receipt amount', amount: row.amount, qty: 1, rate: row.amount }],
      }
    }
    case 'payment': {
      const doc = await supabase
        .from('payment_entries')
        .select('doc_no, entry_date, status, amount, remarks, vendors:vendor_id(name)')
        .eq('id', id)
        .single()
      if (doc.error) throw doc.error
      const row = doc.data as unknown as {
        doc_no: string
        entry_date: string
        status: string
        amount: number
        remarks: string | null
        vendors?: { name: string } | null
      }
      return {
        header: {
          title: 'Vendor Payment',
          docNo: row.doc_no,
          date: row.entry_date,
          status: row.status,
          partyLabel: 'Vendor',
          partyName: row.vendors?.name ?? '-',
          grandTotal: row.amount,
          remarks: row.remarks ?? undefined,
        },
        lines: [{ label: 'Payment amount', amount: row.amount, qty: 1, rate: row.amount }],
      }
    }
    case 'journal': {
      const [doc, items] = await Promise.all([
        supabase.from('journal_entries').select('doc_no, entry_date, status, remarks').eq('id', id).single(),
        supabase
          .from('journal_entry_lines')
          .select('debit, credit, memo, accounts:account_id(code, name)')
          .eq('journal_entry_id', id),
      ])
      if (doc.error) throw doc.error
      if (items.error) throw items.error
      const row = doc.data as unknown as {
        doc_no: string
        entry_date: string
        status: string
        remarks: string | null
      }
      return {
        header: {
          title: 'Journal Entry',
          docNo: row.doc_no,
          date: row.entry_date,
          status: row.status,
          partyLabel: 'Entry',
          partyName: 'General ledger',
          remarks: row.remarks ?? undefined,
        },
        lines: ((items.data as unknown as Array<{
          debit: number
          credit: number
          memo: string | null
          accounts?: { code: string; name: string } | null
        }>) ?? []).map((l) => ({
          label: `${l.accounts?.code ?? ''} ${l.accounts?.name ?? ''}${l.memo ? ` — ${l.memo}` : ''}`.trim(),
          debit: l.debit,
          credit: l.credit,
        })),
      }
    }
    default:
      throw new Error('Unsupported document type')
  }
}

function mapItemLines(data: unknown): Line[] {
  return ((data as Array<{
    description?: string | null
    qty: number
    rate: number
    amount: number
    items?: { sku: string; name: string } | null
  }>) ?? []).map((l) => ({
    label: `${l.items?.sku ?? ''} - ${l.items?.name || l.description || 'Item'}`.replace(/^\s-\s/, ''),
    qty: l.qty,
    rate: l.rate,
    amount: l.amount,
  }))
}
