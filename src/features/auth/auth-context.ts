import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

import type { Database } from '@/shared/supabase/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type AuthStatus = 'loading' | 'guest' | 'authenticated'
export type ProfileState = 'idle' | 'loading' | 'loaded' | 'error'

export interface SignUpResult {
  needsEmailConfirmation: boolean
}

export interface AuthContextValue {
  status: AuthStatus
  isSupabaseConfigured: boolean
  user: User | null
  session: Session | null
  profile: Profile | null
  profileState: ProfileState
  profileError: string | null
  profileErrorDetails: string | null
  retryLoadProfile: () => void
  signUpWithEmail: (
    email: string,
    password: string,
    username: string,
    marketingConsent: boolean,
    inviteCode?: string,
  ) => Promise<SignUpResult>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInWithGoogleIdToken: (idToken: string, nonce: string) => Promise<void>
  signOut: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
  resendConfirmationEmail: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (newPassword: string) => Promise<void>
  isPasswordRecovery: boolean
  clearPasswordRecovery: () => void
  deleteAccount: () => Promise<void>
  /** Écriture générique sur sa propre ligne profiles (avatar, vie privée — Mode Amis,
   * LOT F1) : mêmes colonnes modifiables par la politique RLS profiles_update_own que
   * username/display_name, juste sans message de succès dédié par champ. */
  updateProfile: (patch: Partial<ProfileUpdatableFields>) => Promise<void>
}

export type ProfileUpdatableFields = Pick<
  Profile,
  | 'display_name'
  | 'avatar_url'
  | 'invisible_mode'
  | 'show_live_status'
  | 'show_total_time_score'
  | 'participate_leaderboard'
  | 'marketing_consent'
  | 'marketing_consent_at'
>

export const AuthContext = createContext<AuthContextValue | null>(null)
