import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { nextDocNo } from '../lib/numbering'
import { errorMessage } from '../lib/errors'
import { StatusChip } from '../components/StatusChip'

type Employee = { id: string; code: string; full_name: string; department: string | null; designation: string | null }
type Leave = { id: string; leave_type: string; start_date: string; end_date: string; status: string; employees?: { full_name: string } | null }
type Payroll = { id: string; doc_no: string; status: string; total_amount: number; period_start: string; period_end: string }

export function HrPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [payrolls, setPayrolls] = useState<Payroll[]>([])
  const [code, setCode] = useState('')
  const [fullName, setFullName] = useState('')
  const [department, setDepartment] = useState('')
  const [employeeId, setEmployeeId] = useState('')
  const [attStatus, setAttStatus] = useState('present')
  const [leaveType, setLeaveType] = useState('annual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [basicPay, setBasicPay] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [e, l, p] = await Promise.all([
      supabase.from('employees').select('id, code, full_name, department, designation').order('code'),
      supabase
        .from('leave_requests')
        .select('id, leave_type, start_date, end_date, status, employees:employee_id(full_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('payroll_runs')
        .select('id, doc_no, status, total_amount, period_start, period_end')
        .order('created_at', { ascending: false }),
    ])
    setEmployees(e.data ?? [])
    setLeaves((l.data as unknown as Leave[]) ?? [])
    setPayrolls(p.data ?? [])
    if (!employeeId && e.data?.[0]) setEmployeeId(e.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function onEmployee(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('hr.manage')) return setError('Missing HR manage permission')
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('employees').insert({
      tenant_id: profile.tenant_id,
      code: code.trim(),
      full_name: fullName.trim(),
      department: department.trim() || null,
      join_date: new Date().toISOString().slice(0, 10),
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else {
      setCode('')
      setFullName('')
      setDepartment('')
      await load()
    }
  }

  async function onAttendance(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('hr.manage')) return setError('Missing HR manage permission')
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('attendance').insert({
      tenant_id: profile.tenant_id,
      employee_id: employeeId,
      attendance_date: new Date().toISOString().slice(0, 10),
      status: attStatus,
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else await load()
  }

  async function onLeave(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('hr.manage')) return setError('Missing HR manage permission')
    setBusy(true)
    setError(null)
    const { error: insertError } = await supabase.from('leave_requests').insert({
      tenant_id: profile.tenant_id,
      employee_id: employeeId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      status: 'approved',
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else await load()
  }

  async function onPayroll(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !can('hr.manage')) return setError('Missing HR manage permission')
    if (!employeeId) return
    setBusy(true)
    setError(null)
    try {
      const net = Number(basicPay)
      const today = new Date().toISOString().slice(0, 10)
      const docNo = await nextDocNo(profile.tenant_id, 'payroll_run')
      const { data, error: insertError } = await supabase
        .from('payroll_runs')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          period_start: today,
          period_end: today,
          status: 'draft',
          total_amount: net,
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: lineError } = await supabase.from('payroll_lines').insert({
        payroll_run_id: data.id,
        employee_id: employeeId,
        basic_pay: net,
        deductions: 0,
        net_pay: net,
      })
      if (lineError) throw lineError
      const { error: postError } = await supabase.rpc('post_payroll_run', { p_payroll_run_id: data.id })
      if (postError) throw postError
      setBasicPay('0')
      await load()
    } catch (err) {
      setError(errorMessage(err, 'Payroll failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>HR and payroll basics</h1>
          <p>Employees, attendance, leave, and simple payroll posting</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onEmployee}>
          <h3 style={{ marginTop: 0 }}>Add employee</h3>
          <div className="field">
            <label htmlFor="code">Code</label>
            <input id="code" className="mono" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="name">Name</label>
            <input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="dept">Department</label>
            <input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} />
          </div>
          <button className="btn btn-primary" disabled={busy || !can('hr.manage')} type="submit">
            Save employee
          </button>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Dept</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="mono">{emp.code}</td>
                    <td>{emp.full_name}</td>
                    <td>{emp.department ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <div className="panel panel-body">
          <h3 style={{ marginTop: 0 }}>Attendance / leave / payroll</h3>
          <div className="field">
            <label htmlFor="emp">Employee</label>
            <select id="emp" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.code} - {emp.full_name}
                </option>
              ))}
            </select>
          </div>
          <form onSubmit={onAttendance} style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="att">Today attendance</label>
              <select id="att" value={attStatus} onChange={(e) => setAttStatus(e.target.value)}>
                <option value="present">present</option>
                <option value="absent">absent</option>
                <option value="late">late</option>
                <option value="leave">leave</option>
              </select>
            </div>
            <button className="btn btn-secondary" disabled={busy || !can('hr.manage')} type="submit">
              Save attendance
            </button>
          </form>
          <form onSubmit={onLeave} style={{ marginBottom: 12 }}>
            <div className="field">
              <label htmlFor="lt">Leave type</label>
              <input id="lt" value={leaveType} onChange={(e) => setLeaveType(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ls">Start</label>
              <input id="ls" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="le">End</label>
              <input id="le" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
            <button className="btn btn-secondary" disabled={busy || !can('hr.manage')} type="submit">
              Approve leave
            </button>
          </form>
          <form onSubmit={onPayroll}>
            <div className="field">
              <label htmlFor="pay">Basic / net pay</label>
              <input id="pay" type="number" min="0.01" step="0.01" value={basicPay} onChange={(e) => setBasicPay(e.target.value)} required />
            </div>
            <button className="btn btn-primary" disabled={busy || !can('hr.manage')} type="submit">
              Post payroll
            </button>
          </form>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Leave</th>
                  <th>Employee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.leave_type} ({l.start_date} to {l.end_date})
                    </td>
                    <td>{l.employees?.full_name}</td>
                    <td>
                      <StatusChip status={l.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Payroll</th>
                  <th>Period</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.doc_no}</td>
                    <td>
                      {p.period_start} to {p.period_end}
                    </td>
                    <td className="num">{Number(p.total_amount).toFixed(2)}</td>
                    <td>
                      <StatusChip status={p.status} />
                    </td>
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
