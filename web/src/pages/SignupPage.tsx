import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function SignupPage() {
  const { session, profile, signUp, signUpWithInvite, acceptInvite } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inviteToken = useMemo(() => params.get('invite')?.trim() || '', [params])
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session && profile) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)

    // Existing session without profile + invite link
    if (session && !profile && inviteToken) {
      const joined = await acceptInvite(inviteToken, fullName.trim())
      setBusy(false)
      if (joined.error) {
        setError(joined.error)
        return
      }
      navigate('/')
      return
    }

    const result = inviteToken
      ? await signUpWithInvite(email.trim(), password, fullName.trim(), inviteToken)
      : await signUp(email.trim(), password, fullName.trim(), companyName.trim())
    setBusy(false)
    if (result.error) {
      if (result.error.toLowerCase().includes('confirm email') || result.error.toLowerCase().includes('invite link')) {
        setInfo(result.error)
        return
      }
      setError(result.error)
      return
    }
    navigate('/')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>{inviteToken ? 'Join company' : 'Create company'}</h1>
        <p className="sub">
          {inviteToken
            ? 'Accept an invite and join an existing tenant'
            : 'Boots a tenant with roles, warehouse, taxes, and COA'}
        </p>
        {error ? <div className="alert alert-error">{error}</div> : null}
        {info ? <div className="alert alert-info">{info}</div> : null}
        <div className="field">
          <label htmlFor="fullName">Your name</label>
          <input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        {!inviteToken ? (
          <div className="field">
            <label htmlFor="companyName">Company name</label>
            <input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
        ) : null}
        {!(session && inviteToken) ? (
          <>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
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
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </>
        ) : null}
        <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
          {busy ? 'Working...' : inviteToken ? 'Join with invite' : 'Create account'}
        </button>
        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          Already have access? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  )
}
