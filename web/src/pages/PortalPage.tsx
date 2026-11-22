import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { StatusChip } from '../components/StatusChip'

type Invoice = { id: string; doc_no: string; status: string; invoice_date: string; grand_total: number; amount_paid: number }
type PO = { id: string; doc_no: string; status: string; order_date: string; grand_total: number }

export function PortalPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [mode, setMode] = useState<'customer' | 'vendor'>('customer')
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [pos, setPos] = useState<PO[]>([])
  const [error, setError] = useState<string | null>(null)
  const [customerId, setCustomerId] = useState(profile?.customer_id ?? '')
  const [vendorId, setVendorId] = useState(profile?.vendor_id ?? '')
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([])
  const [vendors, setVendors] = useState<Array<{ id: string; name: string }>>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function loadParties() {
      const [c, v] = await Promise.all([
        supabase.from('customers').select('id, name').eq('is_active', true).order('name'),
        supabase.from('vendors').select('id, name').eq('is_active', true).order('name'),
      ])
      setCustomers(c.data ?? [])
      setVendors(v.data ?? [])
      if (!customerId && (profile?.customer_id || c.data?.[0]?.id)) {
        setCustomerId(profile?.customer_id || c.data![0].id)
      }
      if (!vendorId && (profile?.vendor_id || v.data?.[0]?.id)) {
        setVendorId(profile?.vendor_id || v.data![0].id)
      }
    }
    void loadParties()
  }, [profile?.customer_id, profile?.vendor_id])

  useEffect(() => {
    async function loadDocs() {
      setError(null)
      if (mode === 'customer' && !can('portal.customer')) return
      if (mode === 'vendor' && !can('portal.vendor')) return
      if (mode === 'customer' && customerId) {
        const { data, error: qError } = await supabase
          .from('sales_invoices')
          .select('id, doc_no, status, invoice_date, grand_total, amount_paid')
          .eq('customer_id', customerId)
          .order('invoice_date', { ascending: false })
        if (qError) setError(qError.message)
        else setInvoices(data ?? [])
      }
      if (mode === 'vendor' && vendorId) {
        const { data, error: qError } = await supabase
          .from('purchase_orders')
          .select('id, doc_no, status, order_date, grand_total')
          .eq('vendor_id', vendorId)
          .order('order_date', { ascending: false })
        if (qError) setError(qError.message)
        else setPos(data ?? [])
      }
    }
    void loadDocs()
  }, [mode, customerId, vendorId, can])

  async function linkProfile() {
    if (!profile?.id) return
    if (mode === 'customer' && !can('portal.customer')) {
      setError('Missing portal.customer permission')
      return
    }
    if (mode === 'vendor' && !can('portal.vendor')) {
      setError('Missing portal.vendor permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: updError } = await supabase
      .from('profiles')
      .update({
        customer_id: mode === 'customer' ? customerId || null : profile.customer_id,
        vendor_id: mode === 'vendor' ? vendorId || null : profile.vendor_id,
      })
      .eq('id', profile.id)
    setBusy(false)
    if (updError) setError(updError.message)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Customer / vendor portal</h1>
          <p>Read-only invoices for a customer and POs for a vendor (same app, linked party)</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="toolbar">
        <button className={`btn ${mode === 'customer' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setMode('customer')}>
          Customer view
        </button>
        <button className={`btn ${mode === 'vendor' ? 'btn-primary' : 'btn-secondary'}`} type="button" onClick={() => setMode('vendor')}>
          Vendor view
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={
            busy ||
            (mode === 'customer' && !can('portal.customer')) ||
            (mode === 'vendor' && !can('portal.vendor'))
          }
          onClick={() => void linkProfile()}
        >
          Link selected party to my profile
        </button>
      </div>
      {mode === 'customer' ? (
        <div className="panel panel-body">
          <div className="field">
            <label htmlFor="cust">Customer</label>
            <select
              id="cust"
              value={customerId}
              disabled={!can('portal.customer')}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Paid</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="mono">{inv.doc_no}</td>
                    <td>{inv.invoice_date}</td>
                    <td>
                      <StatusChip status={inv.status} />
                    </td>
                    <td className="num">{Number(inv.grand_total).toFixed(2)}</td>
                    <td className="num">{Number(inv.amount_paid).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="panel panel-body">
          <div className="field">
            <label htmlFor="vend">Vendor</label>
            <select
              id="vend"
              value={vendorId}
              disabled={!can('portal.vendor')}
              onChange={(e) => setVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.doc_no}</td>
                    <td>{p.order_date}</td>
                    <td>
                      <StatusChip status={p.status} />
                    </td>
                    <td className="num">{Number(p.grand_total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
