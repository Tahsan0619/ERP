import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { usePermissions } from '../hooks/usePermissions'

type ProfileRow = { id: string; full_name: string; email: string; is_active: boolean }
type Role = { id: string; code: string; name: string }
type Permission = { id: string; code: string; name: string; module: string }
type UserRole = { user_id: string; role_id: string }
type RolePermission = { role_id: string; permission_id: string }
type InviteRow = {
  id: string
  email: string
  role_code: string
  status: string
  created_at: string
  token: string
}

export function UsersRolesPage() {
  const { profile } = useAuth()
  const { can } = usePermissions()
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleCode, setInviteRoleCode] = useState('R-SALES')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [u, r, p, ur, rp, inv] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, is_active').order('full_name'),
      supabase.from('roles').select('id, code, name').order('code'),
      supabase.from('permissions').select('id, code, name, module').order('module').order('code'),
      supabase.from('user_roles').select('user_id, role_id'),
      supabase.from('role_permissions').select('role_id, permission_id'),
      supabase
        .from('invites')
        .select('id, email, role_code, status, created_at, token')
        .order('created_at', { ascending: false }),
    ])
    if (u.error || r.error || p.error || ur.error || rp.error || inv.error) {
      setError(
        u.error?.message ||
          r.error?.message ||
          p.error?.message ||
          ur.error?.message ||
          rp.error?.message ||
          inv.error?.message ||
          'Load failed',
      )
      return
    }
    setUsers(u.data ?? [])
    setRoles(r.data ?? [])
    setPermissions(p.data ?? [])
    setUserRoles(ur.data ?? [])
    setRolePermissions(rp.data ?? [])
    setInvites((inv.data as InviteRow[]) ?? [])
    if (!selectedRoleId && r.data?.[0]) setSelectedRoleId(r.data[0].id)
  }

  useEffect(() => {
    void load()
  }, [])

  async function toggleUserRole(userId: string, roleId: string, enabled: boolean) {
    setBusy(true)
    setError(null)
    const result = enabled
      ? await supabase.from('user_roles').insert({ user_id: userId, role_id: roleId })
      : await supabase.from('user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
    setBusy(false)
    if (result.error) setError(result.error.message)
    else await load()
  }

  async function toggleRolePermission(roleId: string, permissionId: string, enabled: boolean) {
    if (!can('admin.users')) {
      setError('Missing admin.users permission')
      return
    }
    setBusy(true)
    setError(null)
    const result = enabled
      ? await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId })
      : await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
    setBusy(false)
    if (result.error) setError(result.error.message)
    else await load()
  }

  async function createInvite() {
    if (!can('admin.users')) {
      setError('Missing admin.users permission')
      return
    }
    setBusy(true)
    setError(null)
    setInviteLink(null)
    const { data, error: inviteError } = await supabase.rpc('create_invite', {
      p_email: inviteEmail.trim(),
      p_role_code: inviteRoleCode,
    })
    setBusy(false)
    if (inviteError) {
      setError(inviteError.message)
      return
    }
    const row = Array.isArray(data) ? data[0] : data
    const token = row?.token as string | undefined
    if (!token) {
      setError('Invite created but token missing')
      return
    }
    setInviteLink(`${window.location.origin}/signup?invite=${token}`)
    setInviteEmail('')
    await load()
  }

  async function revokeInvite(inviteId: string) {
    if (!can('admin.users')) {
      setError('Missing admin.users permission')
      return
    }
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId })
    setBusy(false)
    if (updateError) setError(updateError.message)
    else await load()
  }

  async function seedOwnerPermissions() {
    if (!profile?.tenant_id) return
    if (!can('admin.users')) {
      setError('Missing admin.users permission')
      return
    }
    setBusy(true)
    setError(null)
    const owner = roles.find((r) => r.code === 'R-OWNER' || r.code === 'R-ADMIN')
    if (!owner) {
      setBusy(false)
      setError('Owner/Admin role not found')
      return
    }
    const rows = permissions.map((p) => ({ role_id: owner.id, permission_id: p.id }))
    const { error: insertError } = await supabase.from('role_permissions').upsert(rows, {
      onConflict: 'role_id,permission_id',
    })
    setBusy(false)
    if (insertError) setError(insertError.message)
    else await load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users and roles</h1>
          <p>Assign roles and permission matrix</p>
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={busy || !can('admin.users')}
          onClick={() => void seedOwnerPermissions()}
        >
          Grant all to Owner/Admin
        </button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {inviteLink ? <div className="alert alert-info">Invite link: {inviteLink}</div> : null}
      <div className="panel panel-body" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Invite user</h3>
        <div className="toolbar">
          <div className="field" style={{ marginBottom: 0, minWidth: 220 }}>
            <label htmlFor="inviteEmail">Email</label>
            <input id="inviteEmail" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0, minWidth: 180 }}>
            <label htmlFor="inviteRole">Role code</label>
            <select id="inviteRole" value={inviteRoleCode} onChange={(e) => setInviteRoleCode(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.code}>
                  {r.code}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || !inviteEmail.trim() || !can('admin.users')}
            onClick={() => void createInvite()}
          >
            Create invite link
          </button>
        </div>
        <p className="sub" style={{ marginBottom: 0 }}>
          Share the link. The invitee signs up with the same email and joins this tenant (no new company bootstrap).
        </p>
      </div>
      <div className="panel panel-body" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Pending invites</h3>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.length === 0 ? (
                <tr>
                  <td className="empty" colSpan={5}>
                    No invites yet
                  </td>
                </tr>
              ) : (
                invites.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td className="mono">{inv.role_code}</td>
                    <td>
                      <span className="mono">{inv.status}</span>
                    </td>
                    <td>{new Date(inv.created_at).toLocaleString()}</td>
                    <td>
                      {inv.status === 'pending' ? (
                        <button
                          className="btn btn-secondary"
                          type="button"
                          disabled={busy || !can('admin.users')}
                          onClick={() => void revokeInvite(inv.id)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-body">
            <h3 style={{ marginTop: 0 }}>Users</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Roles</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>{u.full_name || '-'}</td>
                      <td>{u.email}</td>
                      <td>
                        <div className="toolbar">
                          {roles.map((r) => {
                            const checked = userRoles.some((ur) => ur.user_id === u.id && ur.role_id === r.id)
                            return (
                              <label key={r.id} style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={busy}
                                  onChange={(e) => void toggleUserRole(u.id, r.id, e.target.checked)}
                                />
                                {r.code}
                              </label>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel panel-body">
          <h3 style={{ marginTop: 0 }}>Permission matrix</h3>
          <div className="field">
            <label htmlFor="role">Role</label>
            <select id="role" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} - {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Permission</th>
                  <th>Allow</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => {
                  const checked = rolePermissions.some(
                    (rp) => rp.role_id === selectedRoleId && rp.permission_id === p.id,
                  )
                  return (
                    <tr key={p.id}>
                      <td>{p.module}</td>
                      <td>
                        {p.name}
                        <div className="mono">{p.code}</div>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busy || !selectedRoleId || !can('admin.users')}
                          onChange={(e) => void toggleRolePermission(selectedRoleId, p.id, e.target.checked)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
