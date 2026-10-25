import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { onSessionRecorded } from '@/features/stats/session-events'
import { useGlobalTimerState } from '@/features/timer/useGlobalTimerState'

import { listUnreadCheers, markCheersRead } from './friends-repository'
import type { UnreadCheer } from './types'
import { useCheersRealtime } from './useCheersRealtime'

/**
 * Encouragements reçus (Mode Amis, LOT F2, §2) : récupérés à l'ouverture de l'app, à
 * chaque fin de session (onSessionRecorded, déjà utilisé par les stats — réutilisé ici
 * plutôt qu'un nouveau mécanisme), et désormais en temps réel (useCheersRealtime, LOT H1 —
 * jusqu'ici un encouragement reçu pendant que l'app était déjà ouverte n'apparaissait
 * qu'au prochain rechargement). Affiché seulement quand on n'est pas en focus
 * (useGlobalTimerState) — jamais de bandeau qui interrompt une session en cours. Le
 * bandeau regroupé (CheersBanner) EST la notification discrète demandée pour les
 * encouragements : pas de toast en plus, qui ferait doublon (voir son propre commentaire).
 */
export function useCheers() {
  const { status } = useAuth()
  const timerState = useGlobalTimerState()
  const [pending, setPending] = useState<UnreadCheer[]>([])

  const refresh = useCallback(() => {
    if (status !== 'authenticated') return
    void listUnreadCheers()
      .then(setPending)
      .catch(() => {
        // Best-effort : un échec ponctuel ne doit jamais bloquer l'app.
      })
  }, [status])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (status !== 'authenticated') return
    return onSessionRecorded(refresh)
  }, [status, refresh])

  useCheersRealtime(refresh, status === 'authenticated')

  const dismiss = useCallback(() => {
    setPending([])
    void markCheersRead().catch(() => {})
  }, [])

  // Dérivé plutôt que synchronisé via un effet séparé : disparaît immédiatement si une
  // session de focus démarre pendant que le bandeau est affiché, pas seulement avant.
  const visible = timerState.liveState === 'focus' ? [] : pending

  return { cheers: visible, dismiss }
}
