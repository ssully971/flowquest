import { useCallback, useContext } from 'react'

import { AuthContext } from '@/features/auth/auth-context'

import { isGuestLocked } from './feature-access'
import type { LockableFeature } from './feature-access'
import { UpsellContext } from './upsell-context'

export interface FeatureAccess {
  isLocked: (feature: LockableFeature) => boolean
  /** Vrai si la fonction est utilisable. Sinon ouvre la modale d'upsell et renvoie faux. */
  requireAccount: (feature: LockableFeature) => boolean
}

/**
 * Point d'entrée unique du contrôle d'accès invité. Lit AuthContext directement (et non
 * useAuth) : monté sans AuthProvider (tests de composants isolés), rien n'est verrouillé.
 */
export function useFeatureAccess(): FeatureAccess {
  const auth = useContext(AuthContext)
  const { openUpsell } = useContext(UpsellContext)
  const locked = auth ? isGuestLocked(auth.status, auth.isSupabaseConfigured) : false

  const isLocked = useCallback(() => locked, [locked])
  const requireAccount = useCallback(
    (feature: LockableFeature) => {
      if (!locked) return true
      openUpsell(feature)
      return false
    },
    [locked, openUpsell],
  )
  return { isLocked, requireAccount }
}
