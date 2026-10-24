import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import type { DerivedLiveState } from '@/features/timer/useGlobalTimerState'
import { useGlobalTimerState } from '@/features/timer/useGlobalTimerState'

import { upsertLiveStatus } from './live-status-repository'

const HEARTBEAT_MS = 60_000

/**
 * Battement de cœur du statut en direct (Mode Amis, LOT F2, §1) : pousse l'état simplifié
 * du minuteur (useGlobalTimerState, partagé par tout l'écran — valable quel que soit le
 * mode affiché) dès qu'il change, et au moins toutes les 60 s sinon. Monté une seule fois,
 * globalement (AppShell), jamais par écran : un changement de mode (Focus → Accueil) ne
 * doit jamais faire croire aux amis qu'on s'est arrêté alors que la session continue.
 */
export function useLiveStatusSync(): void {
  const { status, user } = useAuth()
  const timerState = useGlobalTimerState()
  const lastPushedRef = useRef<{ state: DerivedLiveState; startedAt: number | null; at: number } | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user) return

    const last = lastPushedRef.current
    const changed = !last || last.state !== timerState.liveState || last.startedAt !== timerState.startedAt
    const heartbeatDue = !last || Date.now() - last.at >= HEARTBEAT_MS
    if (!changed && !heartbeatDue) return

    lastPushedRef.current = { state: timerState.liveState, startedAt: timerState.startedAt, at: Date.now() }
    void upsertLiveStatus(user.id, timerState.liveState, timerState.startedAt, timerState.durationMs).catch(() => {
      // Best-effort : un échec ponctuel (hors ligne, etc.) ne doit jamais bloquer l'app.
    })
  }, [status, user, timerState])

  useEffect(() => {
    if (status !== 'authenticated') lastPushedRef.current = null
  }, [status])
}
