import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { AuthGateRequestContext, type AuthGateRequestValue } from './auth-gate-request-context'

/**
 * Permet à n'importe quel écran (panneau Amis, panneau Salons…) de rouvrir l'écran de
 * connexion existant (AuthGate) même après qu'il a été fermé (« continuer en invité »)
 * — LOT H1, §3 : avant, ces écrans affichaient un message sans aucune action quand on
 * n'était pas connecté.
 */
export function AuthGateRequestProvider({ children }: { children: ReactNode }) {
  const [signInRequested, setSignInRequested] = useState(false)
  const value = useMemo<AuthGateRequestValue>(
    () => ({
      signInRequested,
      requestSignIn: () => setSignInRequested(true),
      clearSignInRequest: () => setSignInRequested(false),
    }),
    [signInRequested],
  )
  return <AuthGateRequestContext.Provider value={value}>{children}</AuthGateRequestContext.Provider>
}
