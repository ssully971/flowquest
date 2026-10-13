import type { Session, User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { isSupabaseConfigured, supabase } from '@/shared/supabase/client'
import { useToast } from '@/shared/toast'

import { AuthContext } from './auth-context'
import type { AuthStatus, Profile, SignUpResult } from './auth-context'
import { translateAuthError } from './auth-errors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'guest')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (error) {
        showToast({
          type: 'error',
          message: 'Impossible de charger ton profil. Réessaie plus tard.',
        })
        return
      }
      setProfile(data)
    },
    [showToast],
  )

  useEffect(() => {
    if (!supabase) return
    let cancelled = false

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) {
        void loadProfile(data.session.user.id).then(() => {
          if (!cancelled) setStatus('authenticated')
        })
      } else {
        setStatus('guest')
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (nextSession?.user) {
        void loadProfile(nextSession.user.id)
        setStatus('authenticated')
      } else {
        setProfile(null)
        setStatus('guest')
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signUpWithEmail = useCallback(
    async (email: string, password: string, username: string): Promise<SignUpResult> => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
      return { needsEmailConfirmation: !data.session }
    },
    [showToast],
  )

  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
    },
    [showToast],
  )

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      showToast({ type: 'error', message: translateAuthError(error.message) })
      throw error
    }
  }, [showToast])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      showToast({ type: 'error', message: 'La déconnexion a échoué. Réessaie.' })
      throw error
    }
  }, [showToast])

  const updateUsername = useCallback(
    async (username: string) => {
      if (!supabase || !user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', user.id)
        .select()
        .single()
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
      setProfile(data)
      showToast({ type: 'success', message: 'Pseudo mis à jour.' })
    },
    [user, showToast],
  )

  const value = useMemo(
    () => ({
      status,
      isSupabaseConfigured,
      user,
      session,
      profile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateUsername,
    }),
    [
      status,
      user,
      session,
      profile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateUsername,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
