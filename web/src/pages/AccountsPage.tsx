import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Account } from '../types/database'

export function AccountsPage() {
  const [rows, setRows] = useState<Account[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: qError } = await supabase
        .from('accounts')
        .select('*')
        .order('code', { ascending: true })
      if (qError) setError(qError.message)
      else setRows(data ?? [])
    }
    void load()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chart of accounts</h1>
          <p>Seeded during company bootstrap</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.account_type}</td>
                  <td>{row.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
