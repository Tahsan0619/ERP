import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types/database'

type AuthState = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  profileChecked: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    fullName: string,
    companyName: string,
  ) => Promise<{ error: string | null }>
  completeSetup: (companyName: string, fullName: string) => Promise<{ error: string | null }>
  acceptInvite: (token: string, fullName: string) => Promise<{ error: string | null }>
  signUpWithInvite: (
    email: string,
    password: string,
    fullName: string,
    inviteToken: string,
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true)
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error(userError)
        setProfile(null)
        return
      }
      const user = userData.user
      if (!user) {
        setProfile(null)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (error) {
        console.error(error)
        setProfile(null)
      } else {
        setProfile(data)
      }
    } catch (err) {
      console.error(err)
      setProfile(null)
    } finally {
      setProfileLoading(false)
      setProfileChecked(true)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
      if (!data.session?.user) {
        setProfile(null)
        setProfileChecked(true)
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return
      setSession(next)
      setLoading(false)
      if (!next?.user) {
        setProfile(null)
        setProfileLoading(false)
        setProfileChecked(true)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      setProfile(null)
      setProfileChecked(true)
      return
    }
    void refreshProfile()
  }, [session?.user?.id, loading, refreshProfile])

  const runBootstrap = useCallback(
    async (companyName: string, fullName: string) => {
      const { error: bootError } = await supabase.rpc('bootstrap_tenant', {
        p_tenant_name: companyName,
        p_full_name: fullName,
      })
      if (bootError) {
        await supabase.auth.signOut()
        setProfile(null)
        return { error: bootError.message }
      }
      await refreshProfile()
      return { error: null }
    },
    [refreshProfile],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, fullName: string, companyName: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      if (!data.session) {
        return {
          error:
            'Account created. Confirm email if required, then sign in to finish company setup.',
        }
      }
      return runBootstrap(companyName, fullName)
    },
    [runBootstrap],
  )

  const completeSetup = useCallback(
    async (companyName: string, fullName: string) => runBootstrap(companyName, fullName),
    [runBootstrap],
  )

  const acceptInvite = useCallback(
    async (token: string, fullName: string) => {
      const { error } = await supabase.rpc('accept_invite', {
        p_token: token,
        p_full_name: fullName,
      })
      if (error) return { error: error.message }
      await refreshProfile()
      return { error: null }
    },
    [refreshProfile],
  )

  const signUpWithInvite = useCallback(
    async (email: string, password: string, fullName: string, inviteToken: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) return { error: error.message }
      if (!data.session) {
        return {
          error:
            'Account created. Confirm email if required, then sign in and open the invite link again to join.',
        }
      }
      const accepted = await acceptInvite(inviteToken, fullName)
      if (accepted.error) {
        await supabase.auth.signOut()
        setProfile(null)
      }
      return accepted
    },
    [acceptInvite],
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setProfileChecked(true)
  }, [])

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      profileLoading,
      profileChecked,
      refreshProfile,
      signIn,
      signUp,
      completeSetup,
      acceptInvite,
      signUpWithInvite,
      signOut,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      profileChecked,
      refreshProfile,
      signIn,
      signUp,
      completeSetup,
      acceptInvite,
      signUpWithInvite,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
