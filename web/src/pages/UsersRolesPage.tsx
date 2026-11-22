import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

type ProfileRow = { id: string; full_name: string; email: string; is_active: boolean }
type Role = { id: string; code: string; name: string }
type Permission = { id: string; code: string; name: string; module: string }
type UserRole = { user_id: string; role_id: string }
type RolePermission = { role_id: string; permission_id: string }

export function UsersRolesPage() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    const [u, r, p, ur, rp] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, is_active').order('full_name'),
      supabase.from('roles').select('id, code, name').order('code'),
      supabase.from('permissions').select('id, code, name, module').order('module').order('code'),
      supabase.from('user_roles').select('user_id, role_id'),
      supabase.from('role_permissions').select('role_id, permission_id'),
    ])
    if (u.error || r.error || p.error || ur.error || rp.error) {
      setError(u.error?.message || r.error?.message || p.error?.message || ur.error?.message || rp.error?.message || 'Load failed')
      return
    }
    setUsers(u.data ?? [])
    setRoles(r.data ?? [])
    setPermissions(p.data ?? [])
    setUserRoles(ur.data ?? [])
    setRolePermissions(rp.data ?? [])
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
    setBusy(true)
    setError(null)
    const result = enabled
      ? await supabase.from('role_permissions').insert({ role_id: roleId, permission_id: permissionId })
      : await supabase.from('role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
    setBusy(false)
    if (result.error) setError(result.error.message)
    else await load()
  }

  async function seedOwnerPermissions() {
    if (!profile?.tenant_id) return
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
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => void seedOwnerPermissions()}>
          Grant all to Owner/Admin
        </button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
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
                          disabled={busy || !selectedRoleId}
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
