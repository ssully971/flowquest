import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuthGateRequest } from '@/features/auth/useAuthGateRequest'

import type { LockableFeature } from './feature-access'
import { UpsellModal } from './UpsellModal'
import { UpsellContext } from './upsell-context'
import type { UpsellValue } from './upsell-context'

/**
 * Un seul état de modale d'upsell pour tout le site. À monter dans AuthGateRequestProvider
 * (les boutons de la modale demandent à AuthGate de s'ouvrir sur une vue donnée). Se
 * referme d'elle-même dès que l'utilisateur n'est plus invité (connexion réussie).
 */
export function UpsellProvider({ children }: { children: ReactNode }) {
  const { requestSignIn } = useAuthGateRequest()
  const [feature, setFeature] = useState<LockableFeature | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)

  const openUpsell = useCallback((next: LockableFeature) => {
    const active = document.activeElement
    triggerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    setFeature(next)
  }, [])

  const closeUpsell = useCallback(() => {
    setFeature(null)
    const trigger = triggerRef.current
    triggerRef.current = null
    // Après le rendu qui démonte la modale : le focus revient sur l'élément déclencheur.
    if (trigger) window.setTimeout(() => trigger.isConnected && trigger.focus(), 0)
  }, [])

  const value = useMemo<UpsellValue>(
    () => ({ isOpen: feature !== null, feature, openUpsell, closeUpsell }),
    [feature, openUpsell, closeUpsell],
  )

  return (
    <UpsellContext.Provider value={value}>
      {children}
      {feature !== null ? (
        <UpsellModal
          onClose={closeUpsell}
          onSignUp={() => {
            setFeature(null)
            triggerRef.current = null
            requestSignIn('signUp')
          }}
          onSignIn={() => {
            setFeature(null)
            triggerRef.current = null
            requestSignIn('signIn')
          }}
        />
      ) : null}
    </UpsellContext.Provider>
  )
}
