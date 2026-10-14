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
  retryLoadProfile: () => void
  signUpWithEmail: (email: string, password: string, username: string) => Promise<SignUpResult>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  updateUsername: (username: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
