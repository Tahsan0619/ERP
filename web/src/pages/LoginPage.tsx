import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, LayoutGrid, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

function BrandMark({ dark = false }: { dark?: boolean }) {
  return (
    <div className="brand" style={{ padding: dark ? 0 : undefined }}>
      <div className="brand-mark">
        <LayoutGrid size={16} />
      </div>
      <div>
        <div className={dark ? 'brand-name' : 'brand-name wordmark-split'} style={dark ? { color: 'var(--text)' } : undefined}>
          {dark ? (
            'BusinessOS'
          ) : (
            <>
              <span className="business">Business</span>
              <span className="os">OS</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-split">
      <header className="auth-split-header">
        <BrandMark dark />
        <div className="auth-encrypted">
          <Lock size={14} />
          <span>Encrypted session</span>
        </div>
      </header>
      <main className="auth-split-body">{children}</main>
    </div>
  )
}

function SignInHero() {
  return (
    <div className="auth-hero">
      <div>
        <BrandMark />
        <h1 className="auth-hero-headline">The Operating System for Modern Operations.</h1>
        <p className="auth-hero-copy">
          Unified sales, procurement, perpetual inventory, and general ledger accounting in a single calm workspace.
        </p>
        <div className="auth-hero-card">
          <div className="auth-hero-card-label">
            <span className="live">Ledger pipeline</span>
            <span className="mono" style={{ color: 'var(--accent)' }}>
              Ready
            </span>
          </div>
          <div className="auth-ledger-bars" aria-hidden>
            <span style={{ height: '55%' }} />
            <span style={{ height: '72%' }} />
            <span style={{ height: '48%' }} />
            <span style={{ height: '85%' }} />
            <span style={{ height: '62%' }} />
            <span style={{ height: '78%' }} />
            <span style={{ height: '90%' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 11 }} className="mono">
            <span style={{ color: 'var(--text-muted)' }}>Double-entry sync</span>
            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>Live</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LoginPage() {
  const { session, signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [factorId, setFactorId] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaChecked, setMfaChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function checkMfa() {
      if (!session) {
        if (!cancelled) {
          setMfaRequired(false)
          setFactorId('')
          setMfaChecked(true)
        }
        return
      }
      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (cancelled) return
      if (aalError) {
        setMfaChecked(true)
        return
      }
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
        if (cancelled) return
        if (listError) {
          setError(listError.message)
          setMfaChecked(true)
          return
        }
        const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')
        if (verified) {
          setMfaRequired(true)
          setFactorId(verified.id)
        }
      } else {
        setMfaRequired(false)
        setFactorId('')
      }
      setMfaChecked(true)
    }
    void checkMfa()
    return () => {
      cancelled = true
    }
  }, [session])

  if (session && mfaChecked && !mfaRequired) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(email.trim(), password)
    if (result.error) {
      setBusy(false)
      setError(result.error)
      return
    }

    const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aalError) {
      setBusy(false)
      setError(aalError.message)
      return
    }

    if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
      setBusy(false)
      if (listError) {
        setError(listError.message)
        return
      }
      const verified = (factors?.totp ?? []).find((f) => f.status === 'verified')
      if (!verified) {
        setError('Two-factor authentication is required but no verified factor was found.')
        return
      }
      setMfaRequired(true)
      setFactorId(verified.id)
      return
    }

    setBusy(false)
    navigate('/')
  }

  async function onVerifyMfa(e: FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setBusy(true)
    setError(null)
    const challenge = await supabase.auth.mfa.challenge({ factorId })
    if (challenge.error) {
      setBusy(false)
      setError(challenge.error.message)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: mfaCode.trim(),
    })
    setBusy(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    setMfaRequired(false)
    setMfaCode('')
    navigate('/')
  }

  if (mfaRequired) {
    return (
      <AuthShell>
        <div className="auth-split-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 480 }}>
          <form className="auth-form-inner" onSubmit={onVerifyMfa}>
            <div className="auth-gateway">
              <Building2 size={14} />
              Security verification
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>Two-factor authentication</h1>
            <p className="sub" style={{ margin: '0 0 20px', color: 'var(--text-secondary)' }}>
              Enter the code from your authenticator app
            </p>
            {error ? <div className="alert alert-error">{error}</div> : null}
            <div className="field">
              <label htmlFor="mfaCode">Authentication code</label>
              <input
                id="mfaCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                required
              />
            </div>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
              {busy ? 'Verifying...' : 'Verify and continue'}
            </button>
          </form>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-split-grid">
        <SignInHero />
        <div className="auth-form-panel">
          <form className="auth-form-inner" onSubmit={onSubmit}>
            <div className="auth-gateway">
              <Building2 size={14} />
              Organizational gateway
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 22 }}>Sign in to your organization</h1>
            <p className="sub" style={{ margin: '0 0 20px', color: 'var(--text-secondary)' }}>
              Access your ERP workspace with your company credentials
            </p>
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
            <p style={{ margin: '0 0 12px', textAlign: 'right', fontSize: 13 }}>
              <Link to="/forgot-password">Forgot password?</Link>
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} disabled={busy} type="submit">
              {busy ? 'Signing in...' : 'Sign in to BusinessOS'}
            </button>
            <p className="sub" style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              New company? <Link to="/signup">Create account</Link>
            </p>
          </form>
        </div>
      </div>
    </AuthShell>
  )
}