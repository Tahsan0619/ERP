import { useEffect, useState, type ChangeEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type Attachment = {
  id: string
  file_name: string
  file_path: string
  mime_type: string | null
  created_at: string
}

export function AttachmentsPanel({
  entityType,
  entityId,
}: {
  entityType: string
  entityId: string
}) {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Attachment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data, error: qError } = await supabase
      .from('attachments')
      .select('id, file_name, file_path, mime_type, created_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    if (qError) setError(qError.message)
    else setRows(data ?? [])
  }

  useEffect(() => {
    if (entityId) void load()
  }, [entityId, entityType])

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !profile?.tenant_id || !entityId) return
    setBusy(true)
    setError(null)
    const path = `${profile.tenant_id}/${entityType}/${entityId}/${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('attachments').upload(path, file, {
      upsert: false,
    })
    if (uploadError) {
      setBusy(false)
      setError(uploadError.message)
      return
    }
    const { error: insertError } = await supabase.from('attachments').insert({
      tenant_id: profile.tenant_id,
      entity_type: entityType,
      entity_id: entityId,
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      uploaded_by: profile.id,
    })
    if (insertError) {
      await supabase.storage.from('attachments').remove([path])
      setBusy(false)
      setError(insertError.message)
      return
    }
    setBusy(false)
    await load()
    e.target.value = ''
  }

  async function onOpen(path: string) {
    const { data, error: signedError } = await supabase.storage.from('attachments').createSignedUrl(path, 60)
    if (signedError) {
      setError(signedError.message)
      return
    }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div className="panel panel-body" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Attachments</h3>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="field">
        <label htmlFor={`file-${entityId}`}>Upload file</label>
        <input id={`file-${entityId}`} type="file" disabled={busy || !entityId} onChange={(e) => void onUpload(e)} />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>File</th>
              <th>Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="empty">
                  No attachments
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.file_name}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                  <td>
                    <button className="btn btn-secondary" type="button" onClick={() => void onOpen(row.file_path)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
