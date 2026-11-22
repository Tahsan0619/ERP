import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type AuditRow = {
  id: string
  entity_type: string
  entity_id: string | null
  action: string
  created_at: string
  details: Record<string, unknown>
  profiles?: { full_name: string; email: string } | null
}

export function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error: qError } = await supabase
        .from('audit_logs')
        .select('id, entity_type, entity_id, action, created_at, details, profiles:actor_id(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (qError) setError(qError.message)
      else setRows((data as unknown as AuditRow[]) ?? [])
    }
    void load()
  }, [])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit log</h1>
          <p>Recent posting and system actions</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="panel">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Action</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty">
                    No audit events yet
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.profiles?.full_name || row.profiles?.email || '-'}</td>
                    <td>
                      {row.entity_type}
                      {row.entity_id ? <div className="mono">{row.entity_id.slice(0, 8)}</div> : null}
                    </td>
                    <td>{row.action}</td>
                    <td className="mono">{JSON.stringify(row.details ?? {})}</td>
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
