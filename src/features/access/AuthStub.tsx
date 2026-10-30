import type { ReactNode } from 'react'

import { AuthContext } from '@/features/auth/auth-context'
import type { AuthContextValue, AuthStatus } from '@/features/auth/auth-context'

const noop = async () => {}

/** Aide de test : fournit un AuthContext minimal (invité / connecté / chargement) sans
 * Supabase, pour vérifier le contrôle d'accès du mode invité. */
export function AuthStub({
  status = 'guest',
  configured = true,
  children,
}: {
  status?: AuthStatus
  configured?: boolean
  children: ReactNode
}) {
  const value: AuthContextValue = {
    status,
    isSupabaseConfigured: configured,
    isReconnecting: false,
    user: null,
    session: null,
    profile: null,
    profileState: 'idle',
    profileError: null,
    profileErrorDetails: null,
    retryLoadProfile: () => {},
    signUpWithEmail: async () => ({ needsEmailConfirmation: false }),
    signInWithEmail: noop,
    signInWithGoogle: noop,
    signInWithGoogleIdToken: noop,
    signOut: noop,
    updateUsername: noop,
    resendConfirmationEmail: noop,
    requestPasswordReset: noop,
    updatePassword: noop,
    isPasswordRecovery: false,
    clearPasswordRecovery: () => {},
    deleteAccount: noop,
    updateProfile: noop,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
