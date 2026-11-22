import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { errorMessage } from '../lib/errors'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { AttachmentsPanel } from '../components/AttachmentsPanel'

type SalesInvoice = { id: string; doc_no: string; customer_id: string; grand_total: number; amount_paid: number; customers?: { name: string } | null }
type PurchaseInvoice = { id: string; doc_no: string; vendor_id: string; grand_total: number; amount_paid: number; vendors?: { name: string } | null }
type CreditNote = { id: string; doc_no: string; status: string; credit_date: string; grand_total: number; customers?: { name: string } | null }
type DebitNote = { id: string; doc_no: string; status: string; debit_date: string; grand_total: number; vendors?: { name: string } | null }

export function CreditDebitNotesPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([])
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([])
  const [credits, setCredits] = useState<CreditNote[]>([])
  const [debits, setDebits] = useState<DebitNote[]>([])
  const [salesInvoiceId, setSalesInvoiceId] = useState('')
  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState('')
  const [creditAmount, setCreditAmount] = useState('0')
  const [debitAmount, setDebitAmount] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedCreditId, setSelectedCreditId] = useState('')
  const [selectedDebitId, setSelectedDebitId] = useState('')

  async function load() {
    const [si, pi, cn, dn] = await Promise.all([
      supabase
        .from('sales_invoices')
        .select('id, doc_no, customer_id, grand_total, amount_paid, customers:customer_id(name)')
        .eq('status', 'posted')
        .order('created_at', { ascending: false }),
      supabase
        .from('purchase_invoices')
        .select('id, doc_no, vendor_id, grand_total, amount_paid, vendors:vendor_id(name)')
        .eq('status', 'posted')
        .order('created_at', { ascending: false }),
      supabase
        .from('credit_notes')
        .select('id, doc_no, status, credit_date, grand_total, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('debit_notes')
        .select('id, doc_no, status, debit_date, grand_total, vendors:vendor_id(name)')
        .order('created_at', { ascending: false }),
    ])
    setSalesInvoices((si.data as unknown as SalesInvoice[]) ?? [])
    setPurchaseInvoices((pi.data as unknown as PurchaseInvoice[]) ?? [])
    setCredits((cn.data as unknown as CreditNote[]) ?? [])
    setDebits((dn.data as unknown as DebitNote[]) ?? [])
    if (cn.data?.[0]) setSelectedCreditId((prev) => prev || cn.data![0].id)
    if (dn.data?.[0]) setSelectedDebitId((prev) => prev || dn.data![0].id)
    if (!salesInvoiceId && si.data?.[0]) {
      setSalesInvoiceId(si.data[0].id)
      setCreditAmount(String(si.data[0].grand_total ?? 0))
    }
    if (!purchaseInvoiceId && pi.data?.[0]) {
      setPurchaseInvoiceId(pi.data[0].id)
      setDebitAmount(String(pi.data[0].grand_total ?? 0))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCredit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !salesInvoiceId) return
    if (!can('sales.post')) {
      setError('Missing sales.post permission')
      return
    }
    const amount = Number(creditAmount)
    if (amount <= 0) return setError('Credit amount must be greater than zero')
    setBusy(true)
    setError(null)
    try {
      const inv = salesInvoices.find((i) => i.id === salesInvoiceId)
      if (!inv) throw new Error('Invoice not found')
      const docNo = await nextDocNo(profile.tenant_id, 'credit_note')
      const { data: cn, error: insertError } = await supabase
        .from('credit_notes')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          customer_id: inv.customer_id,
          sales_invoice_id: inv.id,
          credit_date: new Date().toISOString().slice(0, 10),
          grand_total: amount,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: postError } = await supabase.rpc('post_credit_note', { p_credit_note_id: cn.id })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Credit note failed'))
    } finally {
      setBusy(false)
    }
  }

  async function onDebit(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !purchaseInvoiceId) return
    if (!can('purchase.post')) {
      setError('Missing purchase.post permission')
      return
    }
    const amount = Number(debitAmount)
    if (amount <= 0) return setError('Debit amount must be greater than zero')
    setBusy(true)
    setError(null)
    try {
      const inv = purchaseInvoices.find((i) => i.id === purchaseInvoiceId)
      if (!inv) throw new Error('Bill not found')
      const docNo = await nextDocNo(profile.tenant_id, 'debit_note')
      const { data: dn, error: insertError } = await supabase
        .from('debit_notes')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          vendor_id: inv.vendor_id,
          purchase_invoice_id: inv.id,
          debit_date: new Date().toISOString().slice(0, 10),
          grand_total: amount,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: postError } = await supabase.rpc('post_debit_note', { p_debit_note_id: dn.id })
      if (postError) throw postError
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Debit note failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Credit / debit notes</h1>
          <p>Adjust posted sales invoices and purchase bills</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCredit}>
          <h3 style={{ marginTop: 0 }}>Credit note</h3>
          <div className="field">
            <label htmlFor="si">Sales invoice</label>
            <select
              id="si"
              value={salesInvoiceId}
              onChange={(e) => {
                setSalesInvoiceId(e.target.value)
                const inv = salesInvoices.find((i) => i.id === e.target.value)
                if (inv) setCreditAmount(String(inv.grand_total))
              }}
              required
            >
              {salesInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.doc_no} - {i.customers?.name} ({Number(i.grand_total).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cAmt">Amount</label>
            <input id="cAmt" type="number" min="0.01" step="0.01" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || salesInvoices.length === 0 || !can('sales.post')} type="submit">
            Post credit note
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>CN</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {credits.map((c) => (
                  <tr
                    key={c.id}
                    className={c.id === selectedCreditId ? 'row-selected' : undefined}
                    onClick={() => setSelectedCreditId(c.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{c.doc_no}</td>
                    <td>{c.customers?.name ?? '-'}</td>
                    <td>
                      <StatusChip status={c.status} />
                    </td>
                    <td className="num">{Number(c.grand_total).toFixed(2)}</td>
                    <td>
                      <PrintLink type="credit_note" id={c.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedCreditId ? (
              <AttachmentsPanel entityType="credit_note" entityId={selectedCreditId} />
            ) : null}
          </div>
        </form>

        <form className="panel panel-body" onSubmit={onDebit}>
          <h3 style={{ marginTop: 0 }}>Debit note</h3>
          <div className="field">
            <label htmlFor="pi">Purchase invoice</label>
            <select
              id="pi"
              value={purchaseInvoiceId}
              onChange={(e) => {
                setPurchaseInvoiceId(e.target.value)
                const inv = purchaseInvoices.find((i) => i.id === e.target.value)
                if (inv) setDebitAmount(String(inv.grand_total))
              }}
              required
            >
              {purchaseInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.doc_no} - {i.vendors?.name} ({Number(i.grand_total).toFixed(2)})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="dAmt">Amount</label>
            <input id="dAmt" type="number" min="0.01" step="0.01" value={debitAmount} onChange={(e) => setDebitAmount(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || purchaseInvoices.length === 0 || !can('purchase.post')} type="submit">
            Post debit note
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>DN</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {debits.map((d) => (
                  <tr
                    key={d.id}
                    className={d.id === selectedDebitId ? 'row-selected' : undefined}
                    onClick={() => setSelectedDebitId(d.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td className="mono">{d.doc_no}</td>
                    <td>{d.vendors?.name ?? '-'}</td>
                    <td>
                      <StatusChip status={d.status} />
                    </td>
                    <td className="num">{Number(d.grand_total).toFixed(2)}</td>
                    <td>
                      <PrintLink type="debit_note" id={d.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedDebitId ? <AttachmentsPanel entityType="debit_note" entityId={selectedDebitId} /> : null}
          </div>
        </form>
      </div>
    </div>
  )
}