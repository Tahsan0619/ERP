import { useAuth } from '../context/AuthContext'

export function SettingsPage() {
  const { profile, user } = useAuth()

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p>Tenant and profile summary</p>
        </div>
      </div>
      <div className="panel panel-body" style={{ maxWidth: 560 }}>
        <div className="field">
          <label>User</label>
          <div>{profile?.full_name || '-'}</div>
        </div>
        <div className="field">
          <label>Email</label>
          <div>{profile?.email || user?.email}</div>
        </div>
        <div className="field">
          <label>Tenant ID</label>
          <div className="mono">{profile?.tenant_id || '-'}</div>
        </div>
        <div className="alert alert-info">
          Required stack: React + TypeScript frontend with Supabase database and backend services.
        </div>
      </div>
    </div>
  )
}
