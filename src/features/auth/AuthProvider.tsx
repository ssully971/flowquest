import type { Session, User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { isSupabaseConfigured, supabase } from '@/shared/supabase/client'
import { useToast } from '@/shared/toast'

import { AuthContext } from './auth-context'
import type { AuthStatus, Profile, ProfileState, SignUpResult } from './auth-context'
import { translateAuthError } from './auth-errors'

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'guest')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [profileError, setProfileError] = useState<string | null>(null)

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return
      setProfileState('loading')
      setProfileError(null)

      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (!error && data) {
        setProfile(data)
        setProfileState('loaded')
        return
      }

      // La ligne profiles peut manquer (compte créé avant que le trigger de création
      // automatique n'existe, ou tout autre aléa) : on la crée via une fonction SQL
      // sécurisée avant d'abandonner, pour ne jamais rendre la session inutilisable.
      const { data: ensured, error: ensureError } = await supabase.rpc('ensure_profile')
      if (!ensureError && ensured) {
        setProfile(ensured)
        setProfileState('loaded')
        return
      }

      const message = ensureError
        ? translateAuthError(ensureError.message)
        : 'Impossible de charger ton profil. Réessaie plus tard.'
      setProfileError(message)
      setProfileState('error')
      showToast({ type: 'error', message })
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
        void loadProfile(data.session.user.id)
        setStatus('authenticated')
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
        setProfileState('idle')
        setProfileError(null)
        setStatus('guest')
      }
    })

    return () => {
      cancelled = true
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const retryLoadProfile = useCallback(() => {
    if (user) void loadProfile(user.id)
  }, [user, loadProfile])

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
      profileState,
      profileError,
      retryLoadProfile,
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
      profileState,
      profileError,
      retryLoadProfile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      updateUsername,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
