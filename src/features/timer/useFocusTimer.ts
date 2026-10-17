import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import { useAuth } from '@/features/auth/useAuth'

import type { SegmentKind, TimerSnapshot } from './engine/timer-engine'
import { getDurationForSegment } from './durations'
import type { PomodoroDurationsMs } from './durations'
import { notifySegmentFinished, requestNotificationPermission } from './notifications'
import { advancePomodoroCycle, createPomodoroCycle } from './pomodoro-cycle'
import type { PomodoroCycleState } from './pomodoro-cycle'
import { recordSession } from './session-recorder'
import { IndexedDbTimerStateRepository } from './storage/indexed-db-timer-state-repository'
import { SupabaseTimerStateRepository } from './storage/supabase-timer-state-repository'
import { SyncingTimerStateRepository } from './storage/syncing-timer-state-repository'
import { TimerController } from './timer-controller'
import { toDurationsMs } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'
import { useTimerSnapshot } from './useTimerSnapshot'

const localRepository = new IndexedDbTimerStateRepository()
const remoteRepository = new SupabaseTimerStateRepository()
const repository = new SyncingTimerStateRepository(getCurrentUserId)

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

async function createSelectedController(
  segment: SegmentKind,
  durationsMs: PomodoroDurationsMs,
): Promise<TimerController> {
  const controller = TimerController.createIdle(
    repository,
    'pomodoro',
    segment,
    getDurationForSegment(segment, durationsMs),
  )
  await controller.reset()
  return controller
}

async function restoreController(durationsMs: PomodoroDurationsMs): Promise<TimerController> {
  const fallback = TimerController.createIdle(
    repository,
    'pomodoro',
    'focus',
    getDurationForSegment('focus', durationsMs),
  )
  return TimerController.restore(repository, fallback.getState())
}

export function useFocusTimer(): UseFocusTimerResult {
  const { status, user } = useAuth()
  const { settings: timerSettings } = useTimerSettings()
  const [controller, setController] = useState<TimerController | null>(null)
  const [cycle, setCycle] = useState<PomodoroCycleState>(() => createPomodoroCycle())
  const [isReady, setIsReady] = useState(false)
  const [snapshot, refresh] = useTimerSnapshot(controller)
  const settledEndedAtRef = useRef<number | null>(null)
  const pulledForUserRef = useRef<string | null>(null)
  const timerSettingsRef = useRef(timerSettings)

  useEffect(() => {
    timerSettingsRef.current = timerSettings
  }, [timerSettings])

  useEffect(() => {
    let cancelled = false
    restoreController(toDurationsMs(timerSettingsRef.current)).then((restored) => {
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
      const restored = await restoreController(toDurationsMs(timerSettingsRef.current))
      setController(restored)
      setCycle(createPomodoroCycle(restored.getState().segment))
    })()
  }, [status, user])

  /** Avance au segment suivant sans rien enregistrer : les appelants décident eux-mêmes
   * si la session qui se termine doit être consignée (terminée ou abandonnée). Renvoie le
   * nouveau contrôleur pour permettre un démarrage automatique immédiat si activé. */
  const advanceToNext = useCallback(async () => {
    const config = timerSettingsRef.current
    const next = advancePomodoroCycle(cycle, {
      sessionsBeforeLongBreak: config.sessionsBeforeLongBreak,
    })
    const nextController = await createSelectedController(next.segment, toDurationsMs(config))
    setCycle(next)
    setController(nextController)
    return nextController
  }, [cycle])

  const skip = useCallback(() => {
    void (async () => {
      if (controller) {
        const state = controller.getState()
        const liveSnapshot = controller.getSnapshot()
        if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
          await recordSession(state, Date.now(), false)
        }
      }
      await advanceToNext()
    })()
  }, [controller, advanceToNext])

  useEffect(() => {
    if (!controller || !snapshot) return
    if (snapshot.status !== 'completed' || snapshot.endedAt === null) return
    if (settledEndedAtRef.current === snapshot.endedAt) return
    settledEndedAtRef.current = snapshot.endedAt
    const config = timerSettingsRef.current
    notifySegmentFinished(controller.getState().segment, {
      soundEnabled: config.soundEnabled,
      notificationsEnabled: config.notificationsEnabled,
      alertSoundId: config.alertSoundId,
      alertVolume: config.alertVolume,
    })
    void recordSession(controller.getState(), snapshot.endedAt, true)
      .then(() => advanceToNext())
      .then((nextController) => {
        if (!timerSettingsRef.current.autoStartNext) return
        if (timerSettingsRef.current.notificationsEnabled) requestNotificationPermission()
        void nextController.start().then(refresh)
      })
  }, [controller, snapshot, advanceToNext, refresh])

  const selectSegment = useCallback(
    (segment: SegmentKind) => {
      void (async () => {
        if (controller) {
          const state = controller.getState()
          const liveSnapshot = controller.getSnapshot()
          if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
            await recordSession(state, Date.now(), false)
          }
        }
        const nextController = await createSelectedController(
          segment,
          toDurationsMs(timerSettingsRef.current),
        )
        setCycle(createPomodoroCycle(segment))
        setController(nextController)
      })()
    },
    [controller],
  )

  const start = useCallback(() => {
    if (timerSettingsRef.current.notificationsEnabled) requestNotificationPermission()
    void controller?.start().then(refresh)
  }, [controller, refresh])

  const pause = useCallback(() => {
    void controller?.pause().then(refresh)
  }, [controller, refresh])

  const resume = useCallback(() => {
    void controller?.resume().then(refresh)
  }, [controller, refresh])

  const reset = useCallback(() => {
    void (async () => {
      if (controller) {
        const state = controller.getState()
        const liveSnapshot = controller.getSnapshot()
        if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
          await recordSession(state, Date.now(), false)
        }
      }
      await controller?.reset()
      refresh()
    })()
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
