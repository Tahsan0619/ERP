import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import { PrintLink } from '../components/PrintLink'
import { errorMessage } from '../lib/errors'
import { AttachmentsPanel } from '../components/AttachmentsPanel'
import type { Account } from '../types/database'

type Journal = {
  id: string
  doc_no: string
  status: string
  entry_date: string
  remarks: string | null
}

export function JournalsPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [rows, setRows] = useState<Journal[]>([])
  const [debitAccountId, setDebitAccountId] = useState('')
  const [creditAccountId, setCreditAccountId] = useState('')
  const [amount, setAmount] = useState('0')
  const [remarks, setRemarks] = useState('')
  const [selectedJournalId, setSelectedJournalId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [accRes, jeRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('is_active', true).order('code'),
      supabase
        .from('journal_entries')
        .select('id, doc_no, status, entry_date, remarks')
        .order('created_at', { ascending: false }),
    ])
    if (accRes.error) setError(accRes.error.message)
    setAccounts(accRes.data ?? [])
    setRows(jeRes.data ?? [])
    if (!debitAccountId && accRes.data?.[0]) setDebitAccountId(accRes.data[0].id)
    if (!creditAccountId && accRes.data?.[1]) setCreditAccountId(accRes.data[1].id)
    if (!selectedJournalId && jeRes.data?.[0]) setSelectedJournalId(jeRes.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !debitAccountId || !creditAccountId) return
    const amt = Number(amount)
    if (amt <= 0) {
      setError('Amount must be greater than zero')
      return
    }
    if (debitAccountId === creditAccountId) {
      setError('Debit and credit accounts must differ')
      return
    }
    if (!can('finance.post')) {
      setError('Missing finance.post permission')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const docNo = await nextDocNo(profile.tenant_id, 'journal_entry')
      const { data: je, error: jeError } = await supabase
        .from('journal_entries')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          entry_date: new Date().toISOString().slice(0, 10),
          remarks: remarks.trim() || null,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (jeError) throw jeError
      const { error: linesError } = await supabase.from('journal_entry_lines').insert([
        { journal_entry_id: je.id, account_id: debitAccountId, debit: amt, credit: 0 },
        { journal_entry_id: je.id, account_id: creditAccountId, debit: 0, credit: amt },
      ])
      if (linesError) throw linesError
      const { error: postError } = await supabase.rpc('post_journal_entry', {
        p_journal_entry_id: je.id,
      })
      if (postError) throw postError
      setAmount('0')
      setRemarks('')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Failed to post journal'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Journal entries</h1>
          <p>Create balanced journals and post</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Quick journal</h3>
          <div className="field">
            <label htmlFor="debit">Debit account</label>
            <select id="debit" value={debitAccountId} onChange={(e) => setDebitAccountId(e.target.value)} required>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="credit">Credit account</label>
            <select
              id="credit"
              value={creditAccountId}
              onChange={(e) => setCreditAccountId(e.target.value)}
              required
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} - {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="remarks">Remarks</label>
            <input id="remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || accounts.length < 2 || !can('finance.post')} type="submit">
            {busy ? 'Posting...' : 'Create and post journal'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>JV</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => setSelectedJournalId(row.id)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{row.doc_no}</td>
                    <td>{row.entry_date}</td>
                    <td>
                      <StatusChip status={row.status} />
                    </td>
                    <td>{row.remarks ?? '-'}</td>
                    <td>
                      <PrintLink type="journal" id={row.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedJournalId ? <AttachmentsPanel entityType="journal_entry" entityId={selectedJournalId} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
