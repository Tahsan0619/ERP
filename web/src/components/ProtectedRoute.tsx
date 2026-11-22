import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function CompleteSetupCard() {
  const { user, completeSetup, signOut } = useAuth()
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name ?? '')
  const [companyName, setCompanyName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await completeSetup(companyName.trim(), fullName.trim())
    setBusy(false)
    if (result.error) setError(result.error)
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Finish company setup</h1>
        <p className="sub">Your account exists but the company workspace was not created yet.</p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="field">
          <label htmlFor="fullName">Your name</label>
          <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="companyName">Company name</label>
          <input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
          {busy ? 'Setting up...' : 'Complete setup'}
        </button>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', marginTop: 8 }}
          type="button"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </form>
    </div>
  )
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, profileLoading } = useAuth()
  if (loading || (session && profileLoading && !profile)) {
    return (
      <div className="auth-page">
        <div className="auth-card">Loading session...</div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <CompleteSetupCard />
  return children
}