import { useEffect, useMemo, useState } from 'react'

import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import type { RoomClockView } from '@/features/rooms/room-timer'
import type { RoomState } from '@/features/rooms/types'

import type { TimerState } from './engine/timer-engine'
import { IndexedDbTimerStateRepository } from './storage/indexed-db-timer-state-repository'

export type DerivedLiveState = 'focus' | 'pause' | 'inactive'

export interface GlobalTimerSnapshot {
  liveState: DerivedLiveState
  startedAt: number | null
  durationMs: number | null
}

const repository = new IndexedDbTimerStateRepository()
const POLL_INTERVAL_MS = 15_000

const INACTIVE: GlobalTimerSnapshot = { liveState: 'inactive', startedAt: null, durationMs: null }

/**
 * Dérive un état simplifié (focus/pause/inactif) depuis l'état persisté du minuteur
 * (IndexedDB, partagé par tous les écrans — voir useFocusTimer.ts), sans instancier un
 * nouveau TimerController : une simple lecture passive, peu coûteuse, qui reste exacte
 * quel que soit l'écran (Focus, Ambiant, Accueil) où le minuteur tourne réellement.
 */
export function deriveLiveState(state: TimerState | null): GlobalTimerSnapshot {
  if (!state || state.startedAt === null) return INACTIVE
  if (state.status === 'paused') {
    return { liveState: 'pause', startedAt: state.startedAt, durationMs: state.durationMs }
  }
  if (state.status !== 'running') return INACTIVE
  if (state.segment === 'short_break' || state.segment === 'long_break') {
    return { liveState: 'pause', startedAt: state.startedAt, durationMs: state.durationMs }
  }
  return { liveState: 'focus', startedAt: state.startedAt, durationMs: state.durationMs }
}

/** Statut simplifié d'une session de GROUPE (LOT M3) : concentré pendant une phase de focus
 * qui tourne, en pause pendant une pause (salon en pause ou pause Pomodoro), inactif tant
 * que le salon attend son démarrage. */
export function deriveGroupLiveState(
  room: Pick<RoomState, 'startedAt'>,
  view: Pick<RoomClockView, 'status' | 'phase' | 'durationMs'>,
): GlobalTimerSnapshot {
  if (view.status !== 'running' && view.status !== 'paused') return INACTIVE
  const startedAt = room.startedAt ? new Date(room.startedAt).getTime() : null
  const liveState: DerivedLiveState =
    view.status === 'running' && view.phase === 'focus' ? 'focus' : 'pause'
  return { liveState, startedAt, durationMs: view.durationMs }
}

/**
 * Statut simplifié du minuteur, valable pour toute l'app (Mode Amis, LOT F2) : utilisé à
 * la fois pour le battement de cœur du statut en direct (useLiveStatusSync) et pour
 * différer l'affichage des encouragements tant qu'on est en focus (useCheers). Lecture
 * seule, polling léger (15 s) — pas besoin de réactivité immédiate pour ces deux usages.
 */
export function useGlobalTimerState(): GlobalTimerSnapshot {
  const [snapshot, setSnapshot] = useState<GlobalTimerSnapshot>(INACTIVE)
  const { room, view } = useActiveGroupRoom()
  const groupStatus = view?.status
  const groupPhase = view?.phase
  const groupDuration = view?.durationMs
  const roomStartedAt = room?.startedAt

  useEffect(() => {
    let cancelled = false
    const poll = () => {
      void repository.load().then((state) => {
        if (!cancelled) setSnapshot(deriveLiveState(state))
      })
    }
    poll()
    const interval = window.setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  // Pendant une session de groupe, c'est elle qui détermine mon statut (le minuteur
  // personnel est en pause). Mémoïsé : les consommateurs l'utilisent comme dépendance.
  return useMemo(
    () =>
      groupStatus && groupPhase !== undefined
        ? deriveGroupLiveState(
            { startedAt: roomStartedAt ?? null },
            { status: groupStatus, phase: groupPhase, durationMs: groupDuration ?? null },
          )
        : snapshot,
    [groupStatus, groupPhase, groupDuration, roomStartedAt, snapshot],
  )
}
