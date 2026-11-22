import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

type BankAccount = { id: string; name: string; account_id: string }
type Account = { id: string; code: string; name: string }
type StatementLine = {
  id: string
  statement_date: string
  description: string | null
  amount: number
  is_reconciled: boolean
}
type Payment = { id: string; doc_no: string; amount: number }
type Receipt = { id: string; doc_no: string; amount: number }

export function BankReconPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [banks, setBanks] = useState<BankAccount[]>([])
  const [lines, setLines] = useState<StatementLine[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [bankName, setBankName] = useState('')
  const [glAccountId, setGlAccountId] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [lineDate, setLineDate] = useState(new Date().toISOString().slice(0, 10))
  const [lineDesc, setLineDesc] = useState('')
  const [lineAmount, setLineAmount] = useState('0')
  const [matchPaymentId, setMatchPaymentId] = useState('')
  const [matchReceiptId, setMatchReceiptId] = useState('')
  const [selectedLineId, setSelectedLineId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [a, b, p, r] = await Promise.all([
      supabase.from('accounts').select('id, code, name').eq('is_active', true).order('code'),
      supabase.from('bank_accounts').select('id, name, account_id').eq('is_active', true).order('name'),
      supabase.from('payment_entries').select('id, doc_no, amount').eq('status', 'posted').order('created_at', { ascending: false }),
      supabase.from('receipt_entries').select('id, doc_no, amount').eq('status', 'posted').order('created_at', { ascending: false }),
    ])
    setAccounts(a.data ?? [])
    setBanks(b.data ?? [])
    setPayments(p.data ?? [])
    setReceipts(r.data ?? [])
    if (!glAccountId && a.data?.[0]) setGlAccountId(a.data[0].id)
    if (!bankAccountId && b.data?.[0]) setBankAccountId(b.data[0].id)
  }

  async function loadLines(bankId: string) {
    if (!bankId) return
    const { data, error: qError } = await supabase
      .from('bank_statement_lines')
      .select('id, statement_date, description, amount, is_reconciled')
      .eq('bank_account_id', bankId)
      .order('statement_date', { ascending: false })
    if (qError) setError(qError.message)
    else {
      setLines(data ?? [])
      if (!selectedLineId && data?.[0]) setSelectedLineId(data[0].id)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    void loadLines(bankAccountId)
  }, [bankAccountId])

  async function onCreateBank(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('bank.reconcile')) return setError('Missing bank reconcile permission')
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('bank_accounts').insert({
      tenant_id: profile.tenant_id,
      name: bankName.trim(),
      account_id: glAccountId,
      bank_name: bankName.trim(),
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else {
      setBankName('')
      await load()
    }
  }

  async function onAddLine(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !bankAccountId || !can('bank.reconcile')) return setError('Missing bank reconcile permission')
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('bank_statement_lines').insert({
      tenant_id: profile.tenant_id,
      bank_account_id: bankAccountId,
      statement_date: lineDate,
      description: lineDesc.trim() || null,
      amount: Number(lineAmount),
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else {
      setLineDesc('')
      setLineAmount('0')
      await loadLines(bankAccountId)
    }
  }

  async function onReconcile(e: FormEvent) {
    e.preventDefault()
    if (!selectedLineId || !can('bank.reconcile')) return setError('Missing bank reconcile permission')
    if (!matchPaymentId && !matchReceiptId) return setError('Select a payment or receipt to match')
    setBusy(true)
    setError(null)
    const { error: reconError } = await supabase.rpc('reconcile_bank_line', {
      p_line_id: selectedLineId,
      p_payment_id: matchPaymentId || null,
      p_receipt_id: matchReceiptId || null,
    })
    setBusy(false)
    if (reconError) setError(reconError.message)
    else {
      setMatchPaymentId('')
      setMatchReceiptId('')
      await loadLines(bankAccountId)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bank reconciliation</h1>
          <p>Bank accounts, statement lines, and match to posted payments/receipts</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreateBank}>
          <h3 style={{ marginTop: 0 }}>Bank account</h3>
          <div className="field">
            <label htmlFor="bn">Name</label>
            <input id="bn" value={bankName} onChange={(e) => setBankName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="gl">GL account</label>
            <select id="gl" value={glAccountId} onChange={(e) => setGlAccountId(e.target.value)} required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" disabled={busy || !can('bank.reconcile')} type="submit">
            Add bank account
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Bank</th>
                </tr>
              </thead>
              <tbody>
                {banks.map((b) => (
                  <tr key={b.id}>
                    <td>{b.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <div className="panel panel-body">
          <h3 style={{ marginTop: 0 }}>Statement lines</h3>
          <div className="field">
            <label htmlFor="bank">Bank account</label>
            <select id="bank" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={onAddLine}>
            <div className="field">
              <label htmlFor="ld">Date</label>
              <input id="ld" type="date" value={lineDate} onChange={(e) => setLineDate(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="ldesc">Description</label>
              <input id="ldesc" value={lineDesc} onChange={(e) => setLineDesc(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="lamt">Amount (+ in / - out)</label>
              <input id="lamt" type="number" step="0.01" value={lineAmount} onChange={(e) => setLineAmount(e.target.value)} required />
            </div>
            <button className="btn btn-secondary" disabled={busy || !bankAccountId || !can('bank.reconcile')} type="submit">
              Add line
            </button>
          </form>
          <form onSubmit={onReconcile} style={{ marginTop: 16 }}>
            <div className="field">
              <label htmlFor="line">Statement line</label>
              <select id="line" value={selectedLineId} onChange={(e) => setSelectedLineId(e.target.value)}>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.statement_date} {l.description ?? ''} ({Number(l.amount).toFixed(2)}) {l.is_reconciled ? '[done]' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pay">Match payment</label>
              <select id="pay" value={matchPaymentId} onChange={(e) => { setMatchPaymentId(e.target.value); setMatchReceiptId('') }}>
                <option value="">None</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.doc_no} ({Number(p.amount).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="rec">Match receipt</label>
              <select id="rec" value={matchReceiptId} onChange={(e) => { setMatchReceiptId(e.target.value); setMatchPaymentId('') }}>
                <option value="">None</option>
                {receipts.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.doc_no} ({Number(r.amount).toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" disabled={busy || !can('bank.reconcile')} type="submit">
              Mark reconciled
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
