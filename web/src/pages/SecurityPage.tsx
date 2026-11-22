import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function SecurityPage() {
  const [factor, setFactor] = useState<{ id: string; totp?: { qr_code?: string; secret?: string } } | null>(null)
  const [code, setCode] = useState('')
  const [factors, setFactors] = useState<Array<{ id: string; friendly_name?: string; status: string; factor_type: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function loadFactors() {
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) {
      setError(listError.message)
      return
    }
    setFactors([...(data?.totp ?? []), ...(data?.phone ?? [])] as typeof factors)
  }

  useEffect(() => {
    void loadFactors()
  }, [])

  async function startEnroll(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'BusinessOS Authenticator',
    })
    setBusy(false)
    if (enrollError) {
      setError(enrollError.message)
      return
    }
    setFactor(data as typeof factor)
    setInfo('Scan the QR code in your authenticator app, then enter a code to verify.')
  }

  async function verifyEnroll(e: FormEvent) {
    e.preventDefault()
    if (!factor?.id) return
    setBusy(true)
    setError(null)
    const challenge = await supabase.auth.mfa.challenge({ factorId: factor.id })
    if (challenge.error) {
      setBusy(false)
      setError(challenge.error.message)
      return
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.data.id,
      code: code.trim(),
    })
    setBusy(false)
    if (verifyError) {
      setError(verifyError.message)
      return
    }
    setInfo('2FA factor verified and active for this account.')
    setFactor(null)
    setCode('')
    await loadFactors()
  }

  async function unenroll(factorId: string) {
    setBusy(true)
    setError(null)
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId })
    setBusy(false)
    if (unenrollError) setError(unenrollError.message)
    else {
      setInfo('Factor removed.')
      await loadFactors()
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Security / 2FA</h1>
          <p>Enroll TOTP multi-factor authentication for your user (Supabase MFA)</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {info ? <div className="alert alert-info">{info}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={startEnroll}>
          <h3 style={{ marginTop: 0 }}>Enroll authenticator</h3>
          <p className="sub">Uses Supabase Auth MFA. Project MFA must be enabled in Supabase Auth settings.</p>
          <button className="btn btn-primary" disabled={busy} type="submit">
            Start TOTP enroll
          </button>
          {factor?.totp?.qr_code ? (
            <div style={{ marginTop: 16 }}>
              <img src={factor.totp.qr_code} alt="TOTP QR" style={{ maxWidth: 220, background: '#fff', padding: 8 }} />
              {factor.totp.secret ? <div className="mono">Secret: {factor.totp.secret}</div> : null}
            </div>
          ) : null}
        </form>
        <form className="panel panel-body" onSubmit={verifyEnroll}>
          <h3 style={{ marginTop: 0 }}>Verify code</h3>
          <div className="field">
            <label htmlFor="code">Authenticator code</label>
            <input id="code" className="mono" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || !factor} type="submit">
            Verify and activate
          </button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {factors.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty">
                      No MFA factors yet
                    </td>
                  </tr>
                ) : (
                  factors.map((f) => (
                    <tr key={f.id}>
                      <td>
                        {f.friendly_name || f.factor_type}
                      </td>
                      <td>{f.status}</td>
                      <td>
                        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void unenroll(f.id)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  )
}
