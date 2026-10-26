import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'

import { reconcilePillarFromServer } from './apply-session-xp'
import { acknowledgeXpGrant, listUnseenXpGrants } from './xp-grant-notice'

/**
 * Affiche une fois le message « 🎁 Tu as reçu X XP : <motif> » pour chaque cadeau d'XP
 * non encore vu (LOT I3, §6) — puis l'accuse réception (plus jamais affiché) et relit le
 * pilier concerné pour que son XP/niveau reflète immédiatement le cadeau, sans attendre
 * la prochaine session de focus.
 */
export function useXpGrantNotice(): void {
  const { status } = useAuth()
  const { showToast } = useToast()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (status !== 'authenticated' || checkedRef.current) return
    checkedRef.current = true

    void listUnseenXpGrants().then((grants) => {
      for (const grant of grants) {
        showToast({
          type: 'success',
          message: `🎁 Tu as reçu ${grant.amount} XP : ${grant.reason}`,
        })
        void acknowledgeXpGrant(grant.id)
        void reconcilePillarFromServer(grant.pillar_id)
      }
    })
  }, [status, showToast])
}
