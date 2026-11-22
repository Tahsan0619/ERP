import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

type Tax = { id: string; name: string; rate: number }
type Term = { id: string; name: string; due_days: number }
type Uom = { id: string; code: string; name: string }
type Warehouse = { id: string; code: string; name: string; branch_id: string }
type Branch = { id: string; code: string; name: string }

export function OrgMastersPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [terms, setTerms] = useState<Term[]>([])
  const [uoms, setUoms] = useState<Uom[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [taxName, setTaxName] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [termName, setTermName] = useState('')
  const [termDays, setTermDays] = useState('0')
  const [uomCode, setUomCode] = useState('')
  const [uomName, setUomName] = useState('')
  const [whCode, setWhCode] = useState('')
  const [whName, setWhName] = useState('')
  const [branchId, setBranchId] = useState('')

  async function load() {
    const [t, p, u, w, b] = await Promise.all([
      supabase.from('tax_templates').select('id, name, rate').order('name'),
      supabase.from('payment_terms').select('id, name, due_days').order('name'),
      supabase.from('uoms').select('id, code, name').order('code'),
      supabase.from('warehouses').select('id, code, name, branch_id').order('code'),
      supabase.from('branches').select('id, code, name').order('code'),
    ])
    setTaxes(t.data ?? [])
    setTerms(p.data ?? [])
    setUoms(u.data ?? [])
    setWarehouses(w.data ?? [])
    setBranches(b.data ?? [])
    if (!branchId && b.data?.[0]) setBranchId(b.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function addTax(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return
    if (!can('admin.settings')) {
      setError('Missing admin.settings permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('tax_templates').insert({
      tenant_id: profile.tenant_id,
      name: taxName.trim(),
      rate: Number(taxRate) || 0,
    })
    setBusy(false)
    if (insertError) return setError(insertError.message)
    setTaxName('')
    setTaxRate('0')
    await load()
  }

  async function addTerm(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return
    if (!can('admin.settings')) {
      setError('Missing admin.settings permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('payment_terms').insert({
      tenant_id: profile.tenant_id,
      name: termName.trim(),
      due_days: Number(termDays) || 0,
    })
    setBusy(false)
    if (insertError) return setError(insertError.message)
    setTermName('')
    setTermDays('0')
    await load()
  }

  async function addUom(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id) return
    if (!can('admin.settings')) {
      setError('Missing admin.settings permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('uoms').insert({
      tenant_id: profile.tenant_id,
      code: uomCode.trim().toUpperCase(),
      name: uomName.trim(),
    })
    setBusy(false)
    if (insertError) return setError(insertError.message)
    setUomCode('')
    setUomName('')
    await load()
  }

  async function addWarehouse(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !branchId) return
    if (!can('admin.settings')) {
      setError('Missing admin.settings permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('warehouses').insert({
      tenant_id: profile.tenant_id,
      branch_id: branchId,
      code: whCode.trim().toUpperCase(),
      name: whName.trim(),
    })
    setBusy(false)
    if (insertError) return setError(insertError.message)
    setWhCode('')
    setWhName('')
    await load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Organization masters</h1>
          <p>Taxes, payment terms, UOM, and warehouses</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={addTax}>
          <h3 style={{ marginTop: 0 }}>Tax templates</h3>
          <div className="field">
            <label htmlFor="taxName">Name</label>
            <input id="taxName" value={taxName} onChange={(e) => setTaxName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="taxRate">Rate %</label>
            <input id="taxRate" type="number" step="0.01" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('admin.settings')} type="submit">
            Add tax
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Rate</th>
                </tr>
              </thead>
              <tbody>
                {taxes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="num">{Number(t.rate).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={addTerm}>
          <h3 style={{ marginTop: 0 }}>Payment terms</h3>
          <div className="field">
            <label htmlFor="termName">Name</label>
            <input id="termName" value={termName} onChange={(e) => setTermName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="termDays">Due days</label>
            <input id="termDays" type="number" value={termDays} onChange={(e) => setTermDays(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('admin.settings')} type="submit">
            Add term
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="num">Days</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="num">{t.due_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={addUom}>
          <h3 style={{ marginTop: 0 }}>Units of measure</h3>
          <div className="field">
            <label htmlFor="uomCode">Code</label>
            <input id="uomCode" className="mono" value={uomCode} onChange={(e) => setUomCode(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="uomName">Name</label>
            <input id="uomName" value={uomName} onChange={(e) => setUomName(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('admin.settings')} type="submit">
            Add UOM
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {uoms.map((u) => (
                  <tr key={u.id}>
                    <td className="mono">{u.code}</td>
                    <td>{u.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={addWarehouse}>
          <h3 style={{ marginTop: 0 }}>Warehouses</h3>
          <div className="field">
            <label htmlFor="branch">Branch</label>
            <select id="branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} required>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="whCode">Code</label>
            <input id="whCode" className="mono" value={whCode} onChange={(e) => setWhCode(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="whName">Name</label>
            <input id="whName" value={whName} onChange={(e) => setWhName(e.target.value)} required />
          </div>
          <button className="btn btn-primary" disabled={busy || branches.length === 0 || !can('admin.settings')} type="submit">
            Add warehouse
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td className="mono">{w.code}</td>
                    <td>{w.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>
      </div>
    </div>
  )
}
