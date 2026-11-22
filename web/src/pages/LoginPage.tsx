import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(email.trim(), password)
    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    navigate('/')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <div className="brand" style={{ padding: 0, marginBottom: 12 }}>
          <div className="brand-mark">OS</div>
          <div className="brand-name" style={{ color: 'var(--text)' }}>
            BusinessOS
          </div>
        </div>
        <h1>Sign in</h1>
        <p className="sub">Access your ERP workspace</p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          New company? <Link to="/signup">Create account</Link>
        </p>
      </form>
    </div>
  )
}
