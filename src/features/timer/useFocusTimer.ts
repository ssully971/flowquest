import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import { useAuth } from '@/features/auth/useAuth'

import type { SegmentKind, TimerMode, TimerSnapshot } from './engine/timer-engine'
import { getDefaultSegmentForMode, getDurationForSegment, getDurationMsForMode } from './durations'
import { notifySegmentFinished, requestNotificationPermission } from './notifications'
import { advancePomodoroCycle, createPomodoroCycle } from './pomodoro-cycle'
import type { PomodoroCycleState } from './pomodoro-cycle'
import { recordSession } from './session-recorder'
import { getGoalFocusSessions, isGoalReached } from './session-goal'
import { IndexedDbTimerStateRepository } from './storage/indexed-db-timer-state-repository'
import { SupabaseTimerStateRepository } from './storage/supabase-timer-state-repository'
import { SyncingTimerStateRepository } from './storage/syncing-timer-state-repository'
import { TimerController } from './timer-controller'
import { toDurationsMs } from './timer-settings'
import type { TimerSettings } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'
import { useTimerSnapshot } from './useTimerSnapshot'

const localRepository = new IndexedDbTimerStateRepository()
const remoteRepository = new SupabaseTimerStateRepository()
const repository = new SyncingTimerStateRepository(getCurrentUserId)

export interface UseFocusTimerResult {
  isReady: boolean
  mode: TimerMode
  segment: SegmentKind
  cycle: PomodoroCycleState
  snapshot: TimerSnapshot | null
  /** Nombre de sessions de focus complétées depuis le dernier passage en mode pomodoro
   * (indépendant de cycle.completedFocusCount, qui repart de 0 à chaque pause longue). */
  goalProgress: number
  goalReached: boolean
  continueAfterGoal: () => void
  selectMode: (mode: TimerMode) => void
  selectSegment: (segment: SegmentKind) => void
  start: () => void
  pause: () => void
  resume: () => void
  reset: () => void
  skip: () => void
}

async function createSelectedController(
  mode: TimerMode,
  segment: SegmentKind,
  settings: TimerSettings,
): Promise<TimerController> {
  const durationMs = getDurationMsForMode(
    mode,
    segment,
    toDurationsMs(settings),
    settings.countdownMinutes * 60_000,
  )
  const controller = TimerController.createIdle(repository, mode, segment, durationMs)
  await controller.reset()
  return controller
}

async function restoreController(settings: TimerSettings): Promise<TimerController> {
  const fallback = TimerController.createIdle(
    repository,
    'pomodoro',
    'focus',
    getDurationForSegment('focus', toDurationsMs(settings)),
  )
  return TimerController.restore(repository, fallback.getState())
}

export function useFocusTimer(): UseFocusTimerResult {
  const { status, user } = useAuth()
  const { settings: timerSettings } = useTimerSettings()
  const [controller, setController] = useState<TimerController | null>(null)
  const [cycle, setCycle] = useState<PomodoroCycleState>(() => createPomodoroCycle())
  const [goalProgress, setGoalProgress] = useState(0)
  const [goalReached, setGoalReached] = useState(false)
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
    restoreController(timerSettingsRef.current).then((restored) => {
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
      const restored = await restoreController(timerSettingsRef.current)
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
    const nextController = await createSelectedController('pomodoro', next.segment, config)
    setCycle(next)
    setController(nextController)
    return nextController
  }, [cycle])

  const skip = useCallback(() => {
    void (async () => {
      if (!controller || controller.getState().mode !== 'pomodoro') return
      const state = controller.getState()
      const liveSnapshot = controller.getSnapshot()
      if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
        await recordSession(state, Date.now(), false)
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
    const state = controller.getState()
    notifySegmentFinished(state.segment, {
      soundEnabled: config.soundEnabled,
      notificationsEnabled: config.notificationsEnabled,
      alertSoundId: config.alertSoundId,
      alertVolume: config.alertVolume,
    })
    void recordSession(state, snapshot.endedAt, true).then(() => {
      if (state.mode !== 'pomodoro') return

      if (state.segment === 'focus') {
        const target = getGoalFocusSessions({
          goalType: config.sessionGoalType,
          goalCount: config.sessionGoalCount,
          goalMinutes: config.sessionGoalMinutes,
          durations: toDurationsMs(config),
          sessionsBeforeLongBreak: config.sessionsBeforeLongBreak,
        })
        const nextProgress = goalProgress + 1
        const justReached = !isGoalReached(goalProgress, target) && isGoalReached(nextProgress, target)
        setGoalProgress(nextProgress)
        if (justReached) {
          setGoalReached(true)
          return
        }
      }

      void advanceToNext().then((nextController) => {
        if (!timerSettingsRef.current.autoStartNext) return
        if (timerSettingsRef.current.notificationsEnabled) requestNotificationPermission()
        void nextController.start().then(refresh)
      })
    })
  }, [controller, snapshot, advanceToNext, refresh, goalProgress])

  const continueAfterGoal = useCallback(() => {
    setGoalReached(false)
    void advanceToNext().then((nextController) => {
      if (!timerSettingsRef.current.autoStartNext) return
      if (timerSettingsRef.current.notificationsEnabled) requestNotificationPermission()
      void nextController.start().then(refresh)
    })
  }, [advanceToNext, refresh])

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
          'pomodoro',
          segment,
          timerSettingsRef.current,
        )
        setCycle(createPomodoroCycle(segment))
        setController(nextController)
      })()
    },
    [controller],
  )

  const selectMode = useCallback(
    (mode: TimerMode) => {
      void (async () => {
        if (controller) {
          const state = controller.getState()
          const liveSnapshot = controller.getSnapshot()
          if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
            await recordSession(state, Date.now(), false)
          }
        }
        const segment = getDefaultSegmentForMode(mode)
        const nextController = await createSelectedController(
          mode,
          segment,
          timerSettingsRef.current,
        )
        setCycle(createPomodoroCycle(segment))
        setController(nextController)
        setGoalProgress(0)
        setGoalReached(false)
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
    mode: controller?.getState().mode ?? 'pomodoro',
    segment: controller?.getState().segment ?? cycle.segment,
    cycle,
    snapshot,
    goalProgress,
    goalReached,
    continueAfterGoal,
    selectMode,
    selectSegment,
    start,
    pause,
    resume,
    reset,
    skip,
  }
}
