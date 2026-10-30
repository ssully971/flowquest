import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import type { Session, User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { strings } from '@/shared/i18n'
import { isNetworkMessage } from '@/shared/network-errors'
import { isSupabaseConfigured, supabase } from '@/shared/supabase/client'
import { useToast } from '@/shared/toast'

import { AuthContext } from './auth-context'
import type {
  AuthStatus,
  Profile,
  ProfileState,
  ProfileUpdatableFields,
  SignUpResult,
} from './auth-context'
import { translateAuthError } from './auth-errors'

/** Délai maximum d'une tentative de chargement du profil, puis nouvelle tentative (échecs
 * PASSAGERS seulement : réseau, délai, serveur — un refus définitif n'est jamais rejoué). */
const PROFILE_TIMEOUT_MS = 8_000
const PROFILE_RETRY_DELAYS_MS = [1_000, 3_000]
/** Reconnexion après une session momentanément introuvable : 2 s, 5 s, 15 s, puis toutes les 30 s. */
const RECONNECT_DELAYS_MS = [2_000, 5_000, 15_000, 30_000]

// Dernier profil connu par utilisateur : affiché tout de suite (pseudo, avatar) pendant que le
// serveur répond, et conservé si le serveur est lent. Identifiant technique historique : ne pas
// renommer sans migration des données (voir docs/RENOMMAGE.md).
const PROFILE_CACHE_PREFIX = 'flowquest.profileCache.'

function readCachedProfile(userId: string): Profile | null {
  try {
    const raw = window.localStorage.getItem(PROFILE_CACHE_PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Profile
    return parsed && parsed.id === userId ? parsed : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: Profile): void {
  try {
    window.localStorage.setItem(PROFILE_CACHE_PREFIX + profile.id, JSON.stringify(profile))
  } catch {
    // Stockage indisponible (navigation privée, quota) : simple confort perdu.
  }
}

function clearCachedProfile(userId: string): void {
  try {
    window.localStorage.removeItem(PROFILE_CACHE_PREFIX + userId)
  } catch {
    // rien à nettoyer
  }
}

/** Échec passager (réseau coupé, serveur lent ou en erreur) : on garde la session et on réessaie.
 * Tout le reste (jeton révoqué, session absente) est définitif. */
function isTransientAuthError(error: unknown): boolean {
  if (!error) return false
  if (isAuthRetryableFetchError(error)) return true
  const { message, status } = error as { message?: string; status?: number }
  if (typeof status === 'number' && (status === 0 || status >= 500)) return true
  return isNetworkMessage(message)
}

const TIMED_OUT = Symbol('timed-out')

export function AuthProvider({ children }: { children: ReactNode }) {
  const { showToast } = useToast()
  const [status, setStatus] = useState<AuthStatus>(isSupabaseConfigured ? 'loading' : 'guest')
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileState, setProfileState] = useState<ProfileState>('idle')
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileErrorDetails, setProfileErrorDetails] = useState<string | null>(null)
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false)
  // Session momentanément introuvable (réseau lent, jeton en cours de rafraîchissement) :
  // l'utilisateur reste connecté avec son profil, on réessaie en arrière-plan.
  const [isReconnecting, setIsReconnecting] = useState(false)
  const unmountedRef = useRef(false)
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])
  // Supabase déclenche plusieurs évènements onAuthStateChange coup sur coup pour la même
  // session (INITIAL_SESSION, SIGNED_IN, parfois TOKEN_REFRESHED), en particulier juste
  // après un retour OAuth. Sans cette garde, chaque évènement relançait loadProfile() et,
  // en cas d'échec, re-déclenchait le toast d'erreur — d'où une popup qui semblait
  // revenir en boucle après « Continuer avec Google ».
  const loadedForUserRef = useRef<string | null>(null)

  const loadProfile = useCallback(
    async (userId: string) => {
      if (!supabase) return
      const client = supabase
      setProfileError(null)
      setProfileErrorDetails(null)

      // Dernier profil connu : pseudo et avatar s'affichent aussitôt, le serveur confirme ensuite.
      const cached = readCachedProfile(userId)
      if (cached) {
        setProfile((current) => (current && current.id === userId ? current : cached))
        setProfileState('loaded')
      } else {
        setProfileState('loading')
      }

      type Attempt =
        | { profile: Profile }
        | { timedOut: true }
        | {
            error: { code?: string; message: string } | null
            ensureError: { code?: string; message: string } | null
          }

      const attempt = async (): Promise<Attempt> => {
        try {
          const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single()
          if (!error && data) return { profile: data }

          // La ligne profiles peut manquer (compte créé avant que le trigger de création
          // automatique n'existe, ou tout autre aléa) : on la crée via une fonction SQL
          // sécurisée avant d'abandonner, pour ne jamais rendre la session inutilisable.
          const { data: ensured, error: ensureError } = await client.rpc('ensure_profile')
          if (!ensureError && ensured) return { profile: ensured }
          return { error, ensureError }
        } catch (thrown) {
          const message = thrown instanceof Error ? thrown.message : String(thrown)
          return { error: { message }, ensureError: null }
        }
      }

      let last: Attempt = { timedOut: true }
      for (let index = 0; index <= PROFILE_RETRY_DELAYS_MS.length; index += 1) {
        let timer: number | undefined
        const result = await Promise.race([
          attempt(),
          new Promise<typeof TIMED_OUT>((resolve) => {
            timer = window.setTimeout(() => resolve(TIMED_OUT), PROFILE_TIMEOUT_MS)
          }),
        ])
        window.clearTimeout(timer)
        if (unmountedRef.current || loadedForUserRef.current !== userId) return
        if (result !== TIMED_OUT && 'profile' in result) {
          setProfile(result.profile)
          writeCachedProfile(result.profile)
          setProfileState('loaded')
          return
        }
        last = result === TIMED_OUT ? { timedOut: true } : result
        const transient =
          'timedOut' in last ||
          isNetworkMessage(last.error?.message) ||
          isNetworkMessage(last.ensureError?.message)
        const delay = PROFILE_RETRY_DELAYS_MS[index]
        if (!transient || delay === undefined) break
        await new Promise((resolve) => window.setTimeout(resolve, delay))
        if (unmountedRef.current || loadedForUserRef.current !== userId) return
      }

      // Échec définitif ou serveur trop lent : si on a un profil connu, on le garde (l'utilisateur
      // n'a rien à voir) ; sinon état d'erreur explicite avec « Réessayer ».
      if (cached) return
      const ensureError = 'timedOut' in last ? null : last.ensureError
      const error = 'timedOut' in last ? null : last.error
      if (ensureError) {
        // Le message affiché est traduit/générique ; la vraie erreur Supabase part en
        // console pour le diagnostic, jamais avalée silencieusement.
        console.error('[Fokitsu] Échec du chargement du profil (ensure_profile) :', ensureError)
      }
      const message =
        'timedOut' in last
          ? strings.auth.profile.slow
          : ensureError
            ? translateAuthError(ensureError.message)
            : 'Impossible de charger ton profil. Réessaie plus tard.'
      setProfileError(message)
      // Détail technique conservé pour le bloc dépliable « Détails techniques » de
      // l'interface (jamais affiché par défaut) : code et message bruts de Supabase,
      // utiles pour diagnostiquer sans avoir à ouvrir la console.
      const technicalParts = [
        'timedOut' in last ? `délai dépassé (${PROFILE_TIMEOUT_MS / 1000} s)` : null,
        error ? `profiles.select : ${error.code ?? '?'} ${error.message}` : null,
        ensureError ? `ensure_profile : ${ensureError.code ?? '?'} ${ensureError.message}` : null,
      ].filter((part): part is string => part !== null)
      setProfileErrorDetails(technicalParts.length > 0 ? technicalParts.join(' · ') : null)
      setProfileState('error')
      showToast({ type: 'error', message })
    },
    [showToast],
  )

  // Le chargement du profil part HORS du callback onAuthStateChange (Supabase déconseille d'y
  // appeler d'autres méthodes : risque de blocage du verrou d'auth) : report à la prochaine
  // tâche. La garde `loadedForUserRef` évite toujours un rechargement par évènement.
  const loadProfileOnce = useCallback(
    (userId: string) => {
      if (loadedForUserRef.current === userId) return
      loadedForUserRef.current = userId
      window.setTimeout(() => {
        if (!unmountedRef.current) void loadProfile(userId)
      }, 0)
    },
    [loadProfile],
  )

  useEffect(() => {
    if (!supabase) return
    const client = supabase
    let cancelled = false
    let verifying = false
    let reconnecting = false
    let reconnectAttempt = 0
    let reconnectTimer: number | null = null

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const applySession = (next: Session) => {
      reconnecting = false
      reconnectAttempt = 0
      clearReconnectTimer()
      setIsReconnecting(false)
      setSession(next)
      setUser(next.user)
      setStatus('authenticated')
      loadProfileOnce(next.user.id)
    }

    // Déconnexion RÉELLE (SIGNED_OUT explicite, ou session définitivement perdue) : seul cas où
    // l'on repasse en invité et où le profil est effacé.
    const applyGuest = () => {
      reconnecting = false
      reconnectAttempt = 0
      clearReconnectTimer()
      setIsReconnecting(false)
      const previous = loadedForUserRef.current
      if (previous) clearCachedProfile(previous)
      loadedForUserRef.current = null
      setSession(null)
      setUser(null)
      setProfile(null)
      setProfileState('idle')
      setProfileError(null)
      setProfileErrorDetails(null)
      setStatus('guest')
    }

    const startReconnecting = () => {
      reconnecting = true
      setIsReconnecting(true)
      if (reconnectTimer !== null) return
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
      reconnectAttempt += 1
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null
        void verify()
      }, delay)
    }

    // Une session nulle n'est pas forcément une déconnexion : on redemande la session (ce qui
    // retente aussi le rafraîchissement du jeton). Présente → on la garde. Absente avec un échec
    // PASSAGER (réseau, serveur lent) → on garde l'utilisateur et son profil, « reconnexion… »
    // discrète et nouvelle tentative automatique. Absente sans erreur passagère → vraiment perdue.
    const verify = async () => {
      if (verifying || cancelled) return
      verifying = true
      try {
        const { data, error } = await client.auth.getSession()
        if (cancelled) return
        if (data.session?.user) {
          applySession(data.session)
        } else if (error && isTransientAuthError(error)) {
          startReconnecting()
        } else {
          applyGuest()
        }
      } catch (thrown) {
        if (cancelled) return
        if (isTransientAuthError(thrown)) startReconnecting()
        else applyGuest()
      } finally {
        verifying = false
      }
    }

    void verify()

    const { data: listener } = client.auth.onAuthStateChange((event, nextSession) => {
      // Déclenché quand on revient sur le site depuis le lien de réinitialisation reçu
      // par e-mail : la session est valide, mais seulement pour choisir un nouveau mot
      // de passe, pas pour accéder normalement au compte.
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true)

      if (nextSession?.user) {
        applySession(nextSession)
        return
      }
      if (event === 'SIGNED_OUT') {
        applyGuest()
        return
      }
      // Session nulle sans déconnexion explicite : vérification différée, hors du callback.
      window.setTimeout(() => void verify(), 0)
    })

    // Retour du réseau ou de l'onglet pendant une reconnexion : on réessaie tout de suite.
    const retryNow = () => {
      if (!reconnecting) return
      clearReconnectTimer()
      reconnectAttempt = 0
      void verify()
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') retryNow()
    }
    window.addEventListener('online', retryNow)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearReconnectTimer()
      window.removeEventListener('online', retryNow)
      document.removeEventListener('visibilitychange', handleVisibility)
      listener.subscription.unsubscribe()
    }
  }, [loadProfileOnce])

  const retryLoadProfile = useCallback(() => {
    if (user) void loadProfile(user.id)
  }, [user, loadProfile])

  const signUpWithEmail = useCallback(
    async (
      email: string,
      password: string,
      username: string,
      marketingConsent: boolean,
      inviteCode?: string,
    ): Promise<SignUpResult> => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Bêta fermée : le code part dans les metadata et est validé + consommé côté
          // serveur, dans la transaction de création du compte (handle_new_user).
          data: {
            username,
            marketing_consent: marketingConsent,
            ...(inviteCode ? { invite_code: inviteCode } : {}),
          },
          emailRedirectTo: window.location.origin,
        },
      })
      if (error) {
        // Refus du trigger d'inscription : message générique, jamais la raison réelle
        // (code inexistant, utilisé ou expiré — on ne le révèle pas).
        const message =
          inviteCode && error.message.includes('Database error saving new user')
            ? strings.invites.signUp.invalid
            : translateAuthError(error.message)
        showToast({ type: 'error', message })
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

  const signInWithGoogleIdToken = useCallback(
    async (idToken: string, nonce: string) => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce,
      })
      if (error) {
        console.error('[Fokitsu] Échec de la connexion Google (ID token) :', error)
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
    },
    [showToast],
  )

  const resendConfirmationEmail = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
    },
    [showToast],
  )

  const requestPasswordReset = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
    },
    [showToast],
  )

  const updatePassword = useCallback(
    async (newPassword: string) => {
      if (!supabase) throw new Error('Supabase non configuré')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
      setIsPasswordRecovery(false)
      showToast({ type: 'success', message: 'Mot de passe mis à jour.' })
    },
    [showToast],
  )

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false)
  }, [])

  const deleteAccount = useCallback(async () => {
    if (!supabase) throw new Error('Supabase non configuré')
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      console.error('[Fokitsu] Échec de la suppression du compte :', error)
      showToast({ type: 'error', message: translateAuthError(error.message) })
      throw error
    }
    // Le compte n'existe plus côté serveur : la session locale est invalide, on la
    // nettoie nous-mêmes plutôt que d'attendre un évènement onAuthStateChange qui ne
    // viendra pas forcément (le serveur ne peut plus authentifier un jeton dont
    // l'utilisateur a disparu).
    await supabase.auth.signOut()
    if (loadedForUserRef.current) clearCachedProfile(loadedForUserRef.current)
    loadedForUserRef.current = null
    setProfile(null)
    setProfileState('idle')
    setProfileError(null)
    setProfileErrorDetails(null)
    setSession(null)
    setUser(null)
    setStatus('guest')
    showToast({ type: 'success', message: 'Ton compte a été supprimé.' })
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

  const updateProfile = useCallback(
    async (patch: Partial<ProfileUpdatableFields>) => {
      if (!supabase || !user) throw new Error('Non connecté')
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
        .select()
        .single()
      if (error) {
        showToast({ type: 'error', message: translateAuthError(error.message) })
        throw error
      }
      setProfile(data)
    },
    [user, showToast],
  )

  const value = useMemo(
    () => ({
      status,
      isSupabaseConfigured,
      isReconnecting,
      user,
      session,
      profile,
      profileState,
      profileError,
      profileErrorDetails,
      retryLoadProfile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signInWithGoogleIdToken,
      signOut,
      updateUsername,
      resendConfirmationEmail,
      requestPasswordReset,
      updatePassword,
      isPasswordRecovery,
      clearPasswordRecovery,
      deleteAccount,
      updateProfile,
    }),
    [
      status,
      isReconnecting,
      user,
      session,
      profile,
      profileState,
      profileError,
      profileErrorDetails,
      retryLoadProfile,
      signUpWithEmail,
      signInWithEmail,
      signInWithGoogle,
      signInWithGoogleIdToken,
      signOut,
      updateUsername,
      resendConfirmationEmail,
      requestPasswordReset,
      updatePassword,
      isPasswordRecovery,
      clearPasswordRecovery,
      deleteAccount,
      updateProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
