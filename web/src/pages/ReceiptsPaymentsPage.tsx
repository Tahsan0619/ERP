import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { nextDocNo } from '../lib/numbering'
import { StatusChip } from '../components/StatusChip'
import type { Customer, Vendor } from '../types/database'

type Receipt = {
  id: string
  doc_no: string
  status: string
  entry_date: string
  amount: number
  customers?: { name: string } | null
}

type Payment = {
  id: string
  doc_no: string
  status: string
  entry_date: string
  amount: number
  vendors?: { name: string } | null
}

export function ReceiptsPaymentsPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [customerId, setCustomerId] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [receiptAmount, setReceiptAmount] = useState('0')
  const [paymentAmount, setPaymentAmount] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [cRes, vRes, rRes, pRes] = await Promise.all([
      supabase.from('customers').select('*').eq('is_active', true).order('name'),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase
        .from('receipt_entries')
        .select('id, doc_no, status, entry_date, amount, customers:customer_id(name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('payment_entries')
        .select('id, doc_no, status, entry_date, amount, vendors:vendor_id(name)')
        .order('created_at', { ascending: false }),
    ])
    setCustomers(cRes.data ?? [])
    setVendors(vRes.data ?? [])
    setReceipts((rRes.data as unknown as Receipt[]) ?? [])
    setPayments((pRes.data as unknown as Payment[]) ?? [])
    if (!customerId && cRes.data?.[0]) setCustomerId(cRes.data[0].id)
    if (!vendorId && vRes.data?.[0]) setVendorId(vRes.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function ensureSeries(docType: string, prefix: string) {
    if (!profile?.tenant_id) return
    const { data } = await supabase
      .from('number_series')
      .select('id')
      .eq('tenant_id', profile.tenant_id)
      .eq('doc_type', docType)
      .maybeSingle()
    if (!data) {
      await supabase.from('number_series').insert({
        tenant_id: profile.tenant_id,
        doc_type: docType,
        prefix,
        next_number: 1,
      })
    }
  }

  async function onReceipt(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !customerId) return
    const amt = Number(receiptAmount)
    if (amt <= 0) {
      setError('Receipt amount must be greater than zero')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await ensureSeries('receipt_entry', 'REC-')
      const docNo = await nextDocNo(profile.tenant_id, 'receipt_entry')
      const { data, error: insertError } = await supabase
        .from('receipt_entries')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          customer_id: customerId,
          entry_date: new Date().toISOString().slice(0, 10),
          amount: amt,
          mode: 'bank',
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: postError } = await supabase.rpc('post_receipt_entry', {
        p_receipt_entry_id: data.id,
      })
      if (postError) throw postError
      setReceiptAmount('0')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post receipt')
    } finally {
      setBusy(false)
    }
  }

  async function onPayment(e: FormEvent) {
    e.preventDefault()
    if (!profile?.tenant_id || !vendorId) return
    const amt = Number(paymentAmount)
    if (amt <= 0) {
      setError('Payment amount must be greater than zero')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await ensureSeries('payment_entry', 'PAY-')
      const docNo = await nextDocNo(profile.tenant_id, 'payment_entry')
      const { data, error: insertError } = await supabase
        .from('payment_entries')
        .insert({
          tenant_id: profile.tenant_id,
          doc_no: docNo,
          status: 'draft',
          party_type: 'vendor',
          vendor_id: vendorId,
          entry_date: new Date().toISOString().slice(0, 10),
          amount: amt,
          mode: 'bank',
          created_by: profile.id,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      const { error: postError } = await supabase.rpc('post_payment_entry', {
        p_payment_entry_id: data.id,
      })
      if (postError) throw postError
      setPaymentAmount('0')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post payment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Receipts and payments</h1>
          <p>Collect customer receipts and pay vendor bills</p>
        </div>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="grid-2">
        <form className="panel panel-body" onSubmit={onReceipt}>
          <h3 style={{ marginTop: 0 }}>Customer receipt</h3>
          <div className="field">
            <label htmlFor="customer">Customer</label>
            <select id="customer" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="rAmount">Amount</label>
            <input
              id="rAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={receiptAmount}
              onChange={(e) => setReceiptAmount(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={busy || customers.length === 0} type="submit">
            {busy ? 'Posting...' : 'Post receipt'}
          </button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.doc_no}</td>
                    <td>{r.customers?.name ?? '-'}</td>
                    <td>
                      <StatusChip status={r.status} />
                    </td>
                    <td className="num">{Number(r.amount).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </form>

        <form className="panel panel-body" onSubmit={onPayment}>
          <h3 style={{ marginTop: 0 }}>Vendor payment</h3>
          <div className="field">
            <label htmlFor="vendor">Vendor</label>
            <select id="vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} required>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pAmount">Amount</label>
            <input
              id="pAmount"
              type="number"
              min="0.01"
              step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" disabled={busy || vendors.length === 0} type="submit">
            {busy ? 'Posting...' : 'Post payment'}
          </button>
          <div className="table-wrap" style={{ marginTop: 16 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>Payment</th>
                  <th>Vendor</th>
                  <th>Status</th>
                  <th className="num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="mono">{p.doc_no}</td>
                    <td>{p.vendors?.name ?? '-'}</td>
                    <td>
                      <StatusChip status={p.status} />
                    </td>
                    <td className="num">{Number(p.amount).toFixed(2)}</td>
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
