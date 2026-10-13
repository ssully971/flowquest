import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import type { SegmentKind, TimerSnapshot } from './engine/timer-engine'
import { getDurationForSegment, POMODORO_DEFAULTS } from './durations'
import { notifySegmentFinished, requestNotificationPermission } from './notifications'
import { advancePomodoroCycle, createPomodoroCycle } from './pomodoro-cycle'
import type { PomodoroCycleState } from './pomodoro-cycle'
import { IndexedDbTimerStateRepository } from './storage/indexed-db-timer-state-repository'
import { SupabaseTimerStateRepository } from './storage/supabase-timer-state-repository'
import { SyncingTimerStateRepository } from './storage/syncing-timer-state-repository'
import { TimerController } from './timer-controller'
import { useTimerSnapshot } from './useTimerSnapshot'

// Accesseur mutable lu dynamiquement par SyncingTimerStateRepository : le dépôt est un
// singleton créé avant que l'état de connexion soit connu (voir l'effet ci-dessous qui
// le tient à jour).
let currentUserId: string | null = null
const localRepository = new IndexedDbTimerStateRepository()
const remoteRepository = new SupabaseTimerStateRepository()
const repository = new SyncingTimerStateRepository(() => currentUserId)
const cycleConfig = { sessionsBeforeLongBreak: POMODORO_DEFAULTS.sessionsBeforeLongBreak }

export interface UseFocusTimerResult {
  isReady: boolean
  segment: SegmentKind
  cycle: PomodoroCycleState
  snapshot: TimerSnapshot | null
  selectSegment: (segment: SegmentKind) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  skip: () => void
}

async function createSelectedController(segment: SegmentKind): Promise<TimerController> {
  const controller = TimerController.createIdle(
    repository,
    'pomodoro',
    segment,
    getDurationForSegment(segment),
  )
  await controller.reset()
  return controller
}

async function restoreController(): Promise<TimerController> {
  const fallback = TimerController.createIdle(
    repository,
    'pomodoro',
    'focus',
    getDurationForSegment('focus'),
  )
  return TimerController.restore(repository, fallback.getState())
}

export function useFocusTimer(): UseFocusTimerResult {
  const { status, user } = useAuth()
  const [controller, setController] = useState<TimerController | null>(null)
  const [cycle, setCycle] = useState<PomodoroCycleState>(() => createPomodoroCycle())
  const [isReady, setIsReady] = useState(false)
  const [snapshot, refresh] = useTimerSnapshot(controller)
  const settledEndedAtRef = useRef<number | null>(null)
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    currentUserId = status === 'authenticated' ? (user?.id ?? null) : null
  }, [status, user])

  useEffect(() => {
    let cancelled = false
    restoreController().then((restored) => {
      if (cancelled) return
      setController(restored)
      setCycle(createPomodoroCycle(restored.getState().segment))
      setIsReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Reprise sur un autre appareil (§6.2 du cahier des charges) : à la connexion, si
  // l'état distant est plus récent que l'état local, on l'applique. Dernier horodatage
  // gagne — voir docs/SECURITE.md.
  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void (async () => {
      const [local, remote] = await Promise.all([
        localRepository.loadWithMeta(),
        remoteRepository.load(user.id),
      ])
      if (!remote) return
      if (local && local.updatedAt >= remote.updatedAt) return

      await localRepository.save(remote.state, remote.updatedAt)
      const restored = await restoreController()
      setController(restored)
      setCycle(createPomodoroCycle(restored.getState().segment))
    })()
  }, [status, user])

  const skip = useCallback(() => {
    void (async () => {
      const next = advancePomodoroCycle(cycle, cycleConfig)
      const nextController = await createSelectedController(next.segment)
      setCycle(next)
      setController(nextController)
    })()
  }, [cycle])

  useEffect(() => {
    if (!controller || !snapshot) return
    if (snapshot.status !== 'completed' || snapshot.endedAt === null) return
    if (settledEndedAtRef.current === snapshot.endedAt) return
    settledEndedAtRef.current = snapshot.endedAt
    notifySegmentFinished(controller.getState().segment)
    skip()
  }, [controller, snapshot, skip])

  const selectSegment = useCallback((segment: SegmentKind) => {
    void (async () => {
      const nextController = await createSelectedController(segment)
      setCycle(createPomodoroCycle(segment))
      setController(nextController)
    })()
  }, [])

  const start = useCallback(() => {
    requestNotificationPermission()
    void controller?.start().then(refresh)
  }, [controller, refresh])

  const pause = useCallback(() => {
    void controller?.pause().then(refresh)
  }, [controller, refresh])

  const resume = useCallback(() => {
    void controller?.resume().then(refresh)
  }, [controller, refresh])

  const reset = useCallback(() => {
    void controller?.reset().then(refresh)
  }, [controller, refresh])

  return {
    isReady,
    segment: controller?.getState().segment ?? cycle.segment,
    cycle,
    snapshot,
    selectSegment,
    start,
    pause,
    resume,
    reset,
    skip,
  }
}
