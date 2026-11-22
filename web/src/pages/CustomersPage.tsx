import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import type { Customer } from '../types/database'

export function CustomersPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [rows, setRows] = useState<Customer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error: qError } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
    if (qError) setError(qError.message)
    else setRows(data ?? [])
  }

  useEffect(() => {
    void load()
  }, [])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return
    if (!can('admin.settings')) {
      setError('Missing admin.settings permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('customers').insert({
      tenant_id: profile.tenant_id,
      code: code.trim(),
      name: name.trim(),
      phone: phone.trim() || null,
    })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setCode('')
    setName('')
    setPhone('')
    await load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Customer master for sales and receivables</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onCreate}>
          <h3 style={{ marginTop: 0 }}>Create customer</h3>
          <div className="field">
            <label htmlFor="code">Code</label>
            <input id="code" className="mono" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('admin.settings')} type="submit">
            {busy ? 'Saving...' : 'Save customer'}
          </button>
        </form>
        <div className="panel">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phone</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{row.code}</td>
                    <td>{row.name}</td>
                    <td>{row.phone ?? '-'}</td>
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
