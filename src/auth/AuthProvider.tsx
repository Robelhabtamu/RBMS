import { AuthApiError, type PostgrestError, type Session, type User } from '@supabase/supabase-js'
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseClient } from '../lib/supabase/client'
import type { AuthIssue, Profile } from './types'

type AuthContextValue = {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  issue: AuthIssue | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [issue, setIssue] = useState<AuthIssue | null>(null)

  const configurationIssue = (configurationError: unknown): AuthIssue => ({
    code: 'CONFIGURATION_ERROR',
    message: configurationError instanceof Error
      ? configurationError.message
      : 'Supabase configuration could not be loaded. Check .env.local and restart the app.',
  })

  const profileQueryIssue = (profileError: PostgrestError): AuthIssue => {
    const accessDenied = profileError.code === '42501'
      || profileError.code === 'PGRST301'
      || profileError.message.toLowerCase().includes('permission denied')

    return accessDenied
      ? {
          code: 'PROFILE_ACCESS_DENIED',
          message: 'Authentication succeeded, but Row Level Security or database permissions blocked access to your profile.',
        }
      : {
          code: 'PROFILE_LOAD_FAILED',
          message: 'Authentication succeeded, but the profile query failed. Confirm the profiles table and migrations exist in this Supabase project.',
        }
  }

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error: profileError } = await getSupabaseClient()
      .from('profiles')
      .select('id, full_name, role, status')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) throw profileQueryIssue(profileError)
    if (!data) {
      throw {
        code: 'PROFILE_NOT_FOUND',
        message: 'Authentication succeeded, but no accessible profile row was found for this user. Create the matching profile or verify its self-read RLS policy.',
      } satisfies AuthIssue
    }
    return data as Profile
  }, [])

  useEffect(() => {
    let active = true
    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch (configurationError) {
      setIssue(configurationIssue(configurationError))
      setLoading(false)
      return
    }

    const applySession = async (nextSession: Session | null) => {
      if (!active) return
      setSession(nextSession)
      setIssue(null)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const nextProfile = await loadProfile(nextSession.user.id)
        if (active) setProfile(nextProfile)
      } catch (profileError) {
        if (active) {
          setProfile(null)
          const nextIssue = typeof profileError === 'object' && profileError !== null && 'code' in profileError && 'message' in profileError
            ? profileError as AuthIssue
            : { code: 'PROFILE_LOAD_FAILED', message: 'Authentication succeeded, but the profile could not be loaded.' } satisfies AuthIssue
          setIssue(nextIssue)
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        setIssue({ code: 'SIGN_IN_FAILED', message: 'The saved Supabase session could not be restored. Please sign in again.' })
        setLoading(false)
        return
      }
      void applySession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true)
      void applySession(nextSession)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setIssue(null)
    let supabase: ReturnType<typeof getSupabaseClient>
    try {
      supabase = getSupabaseClient()
    } catch (configurationError) {
      throw configurationIssue(configurationError)
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      const invalidCredentials = signInError instanceof AuthApiError && signInError.code === 'invalid_credentials'
      throw {
        code: 'SIGN_IN_FAILED',
        message: invalidCredentials
          ? 'Supabase rejected the email or password.'
          : 'Supabase sign-in failed. Check the project URL, network connection, and Auth user configuration.',
      } satisfies AuthIssue
    }
  }, [])

  const signOut = useCallback(async () => {
    const { error: signOutError } = await getSupabaseClient().auth.signOut()
    if (signOutError) throw signOutError
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user: session?.user ?? null,
    profile,
    loading,
    issue,
    signIn,
    signOut,
  }), [issue, loading, profile, session, signIn, signOut])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
