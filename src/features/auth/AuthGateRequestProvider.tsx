import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { UpsellProvider } from '@/features/access/UpsellProvider'

import {
  AuthGateRequestContext,
  type AuthGateRequestValue,
  type AuthGateRequestedView,
} from './auth-gate-request-context'

/**
 * Permet à n'importe quel écran (panneau Amis, panneau Salons…) de rouvrir l'écran de
 * connexion existant (AuthGate) même après qu'il a été fermé (« continuer en invité »)
 * — LOT H1, §3 : avant, ces écrans affichaient un message sans aucune action quand on
 * n'était pas connecté.
 */
export function AuthGateRequestProvider({ children }: { children: ReactNode }) {
  const [signInRequested, setSignInRequested] = useState(false)
  const [requestedView, setRequestedView] = useState<AuthGateRequestedView>('signIn')
  const value = useMemo<AuthGateRequestValue>(
    () => ({
      signInRequested,
      requestedView,
      requestSignIn: (view = 'signIn') => {
        setRequestedView(view)
        setSignInRequested(true)
      },
      clearSignInRequest: () => setSignInRequested(false),
    }),
    [signInRequested, requestedView],
  )
  return (
    <AuthGateRequestContext.Provider value={value}>
      {/* Modale d'upsell du mode invité (un seul état pour tout le site) : montée ici car elle
          a besoin de requestSignIn. Voir docs/MODE_INVITE.md. */}
      <UpsellProvider>{children}</UpsellProvider>
    </AuthGateRequestContext.Provider>
  )
}
