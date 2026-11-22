import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type FiscalYear = {
  id: string
  name: string
  start_date: string
  end_date: string
  is_closed: boolean
}

export function FiscalYearsPage() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<FiscalYear[]>([])
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error: qError } = await supabase
      .from('fiscal_years')
      .select('id, name, start_date, end_date, is_closed')
      .order('start_date', { ascending: false })
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
    const { error: insertError } = await supabase.from('fiscal_years').insert({
      tenant_id: profile.tenant_id,
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      is_closed: false,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setName('')
    setStartDate('')
    setEndDate('')
    await load()
  }

  async function toggleLock(id: string, isClosed: boolean) {
    setBusy(true)
    setError(null)
    const { error: updError } = await supabase
      .from('fiscal_years')
      .update({ is_closed: isClosed })
      .eq('id', id)
    setBusy(false)
    if (updError) setError(updError.message)
    else await load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Fiscal years</h1>
          <p>Create periods and lock posting dates</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create fiscal year</h3>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="start">Start date</label>
            <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="end">End date</label>
            <input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy} type="submit">
            Save
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.start_date}</td>
                    <td>{row.end_date}</td>
                    <td>{row.is_closed ? 'Locked' : 'Open'}</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void toggleLock(row.id, !row.is_closed)}
                      >
                        {row.is_closed ? 'Unlock' : 'Lock'}
                      </button>
                    </td>
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
