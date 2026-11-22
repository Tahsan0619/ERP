import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function usePermissions() {
  const { profile } = useAuth()
  const [codes, setCodes] = useState<Set<string>>(new Set())
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profile?.id) {
        setCodes(new Set())
        setIsAdmin(false)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data: roles } = await supabase
        .from('user_roles')
        .select('roles(code), role_id')
        .eq('user_id', profile.id)
      const roleRows = (roles as Array<{ role_id: string; roles?: { code?: string } | null }> | null) ?? []
      const admin = roleRows.some((r) => r.roles?.code === 'R-OWNER' || r.roles?.code === 'R-ADMIN')
      setIsAdmin(admin)

      const roleIds = roleRows.map((r) => r.role_id)
      if (roleIds.length === 0) {
        setCodes(new Set())
        setLoading(false)
        return
      }
      const { data: perms } = await supabase
        .from('role_permissions')
        .select('permissions(code)')
        .in('role_id', roleIds)
      const next = new Set<string>()
      for (const row of (perms as Array<{ permissions?: { code?: string } | null }> | null) ?? []) {
        if (row.permissions?.code) next.add(row.permissions.code)
      }
      setCodes(next)
      setLoading(false)
    }
    void load()
  }, [profile?.id])

  const can = useCallback(
    (code: string) => {
      if (isAdmin) return true
      return codes.has(code)
    },
    [codes, isAdmin],
  )

  return { can, isAdmin, loading, codes }
}
