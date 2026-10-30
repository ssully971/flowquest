import { useCallback, useEffect, useRef, useState } from 'react'

import { getCurrentUserId } from '@/features/auth/current-user'
import { useAuth } from '@/features/auth/useAuth'
import { getActivePillarId } from '@/features/pillars/active-pillar-ref'
import type { PillarXpResult } from '@/features/pillars/apply-session-xp'
import { getPillarsEnabled } from '@/features/settings/pillars-enabled-ref'
import { getDb } from '@/shared/storage/db'

import type { CycleSummary } from './cycle-summary'
import { computeCycleSummary, summarizeSoloSession } from './cycle-summary'
import { getEndedAt } from './engine/timer-engine'
import type { SegmentKind, TimerMode, TimerSnapshot, TimerState } from './engine/timer-engine'
import { getDefaultSegmentForMode, getDurationForSegment, getDurationMsForMode } from './durations'
import { notifySegmentFinished, requestNotificationPermission } from './notifications'
import {
  advancePomodoroCycle,
  countFocusSessionsSinceLastLongBreak,
  createPomodoroCycle,
  effectiveSessionsBeforeLongBreak,
} from './pomodoro-cycle'
import type { PomodoroCycleState } from './pomodoro-cycle'
import { MIN_RECORDED_SECONDS, recordSession } from './session-recorder'
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
  /** Horodatage de départ de la phase en cours (`null` tant qu'elle n'a pas démarré) —
   * fixe pendant toute la phase, y compris pause/reprise (seul `advanceToNext`/un
   * changement de segment le remet à zéro) : sert de clé de « début de phase » stable
   * pour la citation du LOT G1 (usePhaseQuote), sans dépendre de `snapshot`, qui ne
   * l'expose pas. */
  startedAt: number | null
  cycle: PomodoroCycleState
  snapshot: TimerSnapshot | null
  /** Nombre de sessions de focus complétées depuis le dernier passage en mode pomodoro
   * (indépendant de cycle.completedFocusCount, qui repart de 0 à chaque pause longue). */
  goalProgress: number
  goalReached: boolean
  continueAfterGoal: () => void
  /** Vrai pendant qu'une session (focus ou pause) tourne ou est en pause : les onglets de
   * segment doivent rester bloqués tant que c'est le cas (LOT E5 — jamais de fin de
   * session implicite en cliquant sur « Pause courte »/« Pause longue »). */
  isSegmentSwitchBlocked: boolean
  /** Vrai une fois le cycle terminé (bouton Terminer, ou seuil « s'arrêter après N
   * sessions » atteint) : un écran de fin doit remplacer l'affichage normal du minuteur. */
  cycleEnded: boolean
  sessionSummary: CycleSummary | null
  /** Dernier pilier ayant gagné un niveau pendant le cycle en cours (LOT G3) — `null`
   * sinon. Remis à zéro à `acknowledgeSessionEnd` : sert à l'animation brève du bilan de
   * session (SessionEndScreen), jamais une popup séparée. */
  pillarLevelUp: PillarXpResult | null
  /** Termine le cycle en cours pour de bon (LOT E6) : enregistre la session active si besoin,
   * puis affiche l'écran de fin. */
  endSession: () => void
  /** Accuse réception de l'écran de fin et repart sur un cycle neuf. */
  acknowledgeSessionEnd: () => void
  selectMode: (mode: TimerMode) => void
  selectSegment: (segment: SegmentKind) => void
  start: () => void
  pause: (at?: number) => void
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

/**
 * Numéro de session reconstruit depuis l'historique réel plutôt que de repartir d'un
 * compteur à 0 (LOT E3) : l'historique local (IndexedDB) reflète déjà les sessions du
 * compte une fois synchronisées (voir useSessionSync), donc correct aussi bien après un
 * rechargement que sur un nouvel appareil, une fois le tirage distant arrivé.
 */
async function createSyncedPomodoroCycle(segment: SegmentKind): Promise<PomodoroCycleState> {
  try {
    const db = await getDb()
    const sessions = await db.getAll('focusSessions')
    return { segment, completedFocusCount: countFocusSessionsSinceLastLongBreak(sessions) }
  } catch {
    return createPomodoroCycle(segment)
  }
}

export function useFocusTimer(): UseFocusTimerResult {
  const { status, user } = useAuth()
  const { settings: timerSettings } = useTimerSettings()
  const [controller, setController] = useState<TimerController | null>(null)
  const [cycle, setCycle] = useState<PomodoroCycleState>(() => createPomodoroCycle())
  const [goalProgress, setGoalProgress] = useState(0)
  const [goalReached, setGoalReached] = useState(false)
  const [cycleEnded, setCycleEnded] = useState(false)
  const [sessionSummary, setSessionSummary] = useState<CycleSummary | null>(null)
  const [pillarLevelUp, setPillarLevelUp] = useState<PillarXpResult | null>(null)
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
    restoreController(timerSettingsRef.current).then(async (restored) => {
      if (cancelled) return
      setController(restored)
      setCycle(await createSyncedPomodoroCycle(restored.getState().segment))
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
      setCycle(await createSyncedPomodoroCycle(restored.getState().segment))
    })()
  }, [status, user])

  /** Avance au segment suivant sans rien enregistrer : les appelants décident eux-mêmes
   * si la session qui se termine doit être consignée (terminée ou abandonnée). Renvoie le
   * nouveau contrôleur pour permettre un démarrage automatique immédiat si activé. */
  const advanceToNext = useCallback(async () => {
    const config = timerSettingsRef.current
    const next = advancePomodoroCycle(cycle, {
      sessionsBeforeLongBreak: effectiveSessionsBeforeLongBreak(config),
    })
    const nextController = await createSelectedController('pomodoro', next.segment, config)
    setCycle(next)
    setController(nextController)
    return nextController
  }, [cycle])

  /** Bilan + bascule vers l'écran de fin (LOT E6), utilisé aussi bien par l'arrêt manuel
   * (bouton Terminer) que par le seuil automatique « s'arrêter après N sessions ». */
  const finishCycle = useCallback(async () => {
    const db = await getDb()
    const [sessions, tasks] = await Promise.all([db.getAll('focusSessions'), db.getAll('tasks')])
    setSessionSummary(computeCycleSummary(sessions, tasks))
    setCycleEnded(true)
  }, [])

  /** Bilan d'une session Chrono / Minuteur (une seule phase) puis écran de fin. */
  const finishSolo = useCallback(async (state: TimerState, endedAt: number) => {
    const db = await getDb()
    const tasks = await db.getAll('tasks')
    const pillarActive = getPillarsEnabled() && getActivePillarId() !== null
    setSessionSummary(summarizeSoloSession(state, endedAt, tasks, pillarActive))
    setCycleEnded(true)
  }, [])

  const skip = useCallback(() => {
    void (async () => {
      if (!controller || controller.getState().mode !== 'pomodoro') return
      const state = controller.getState()
      const liveSnapshot = controller.getSnapshot()
      if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
        const result = await recordSession(state, Date.now(), false)
        if (result?.leveledUp) setPillarLevelUp(result)
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
    void recordSession(state, snapshot.endedAt, true).then((result) => {
      if (result?.leveledUp) setPillarLevelUp(result)
      if (state.mode === 'countdown') {
        // Fin naturelle du Minuteur : bilan de la session, comme après « Terminer ».
        void finishSolo(state, snapshot.endedAt as number)
        return
      }
      if (state.mode !== 'pomodoro') return

      // Réglage « Fin de cycle » (LOT E5) : en mode « s'arrêter après N sessions », on ne
      // boucle jamais indéfiniment — une fois le seuil atteint, la session se termine pour
      // de bon (écran de fin) au lieu d'enchaîner une pause longue.
      if (
        state.segment === 'focus' &&
        config.cycleEndMode === 'stopAfterN' &&
        cycle.completedFocusCount + 1 >= config.sessionsBeforeLongBreak
      ) {
        void finishCycle()
        return
      }

      if (state.segment === 'focus') {
        const target = getGoalFocusSessions({
          goalType: config.sessionGoalType,
          goalCount: config.sessionGoalCount,
          goalMinutes: config.sessionGoalMinutes,
          durations: toDurationsMs(config),
          sessionsBeforeLongBreak: config.sessionsBeforeLongBreak,
        })
        const nextProgress = goalProgress + 1
        const justReached =
          !isGoalReached(goalProgress, target) && isGoalReached(nextProgress, target)
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
  }, [controller, snapshot, advanceToNext, refresh, goalProgress, cycle, finishCycle, finishSolo])

  const continueAfterGoal = useCallback(() => {
    setGoalReached(false)
    void advanceToNext().then((nextController) => {
      if (!timerSettingsRef.current.autoStartNext) return
      if (timerSettingsRef.current.notificationsEnabled) requestNotificationPermission()
      void nextController.start().then(refresh)
    })
  }, [advanceToNext, refresh])

  const endSession = useCallback(() => {
    void (async () => {
      if (!controller) {
        await finishCycle()
        return
      }
      const state = controller.getState()
      const now = Date.now()
      const liveSnapshot = controller.getSnapshot(now)
      const isCompleted = liveSnapshot.status === 'completed'
      // Chrono / Minuteur : sous une minute de focus, terminer à la main n'enregistre rien
      // (clic accidentel).
      const longEnough = liveSnapshot.elapsedMs >= MIN_RECORDED_SECONDS * 1000
      const wasStarted = state.startedAt !== null && !isCompleted

      if (state.mode !== 'pomodoro') {
        // Chrono / Minuteur : jamais lancé, ou trop court → rien à enregistrer ni à résumer.
        if (state.startedAt === null || !longEnough) {
          await controller.reset()
          refresh()
          return
        }
        if (wasStarted) {
          const result = await recordSession(state, now, false)
          if (result?.leveledUp) setPillarLevelUp(result)
        }
        await finishSolo(
          state,
          isCompleted ? (liveSnapshot.endedAt ?? getEndedAt(state) ?? now) : now,
        )
        await controller.reset()
        return
      }

      // Pomodoro : comportement historique, toute phase démarrée est enregistrée.
      if (wasStarted) {
        const result = await recordSession(state, now, false)
        if (result?.leveledUp) setPillarLevelUp(result)
      }
      await finishCycle()
    })()
  }, [controller, finishCycle, finishSolo, refresh])

  const acknowledgeSessionEnd = useCallback(() => {
    void (async () => {
      // Le Chrono et le Minuteur restent dans leur mode ; le Pomodoro repart sur un focus neuf.
      const mode = controller?.getState().mode ?? 'pomodoro'
      const segment = mode === 'pomodoro' ? 'focus' : getDefaultSegmentForMode(mode)
      const nextController = await createSelectedController(mode, segment, timerSettingsRef.current)
      setCycle(createPomodoroCycle(segment))
      setController(nextController)
      setGoalProgress(0)
      setGoalReached(false)
      setCycleEnded(false)
      setSessionSummary(null)
      setPillarLevelUp(null)
    })()
  }, [controller])

  const selectSegment = useCallback(
    (segment: SegmentKind) => {
      void (async () => {
        if (controller) {
          const state = controller.getState()
          const liveSnapshot = controller.getSnapshot()
          // LOT E5 : jamais de fin de session implicite en changeant d'onglet — l'UI
          // désactive déjà les onglets tant qu'une session tourne ou est en pause ; ce
          // garde-fou protège aussi un appel direct à selectSegment.
          if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
            return
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
            const result = await recordSession(state, Date.now(), false)
            if (result?.leveledUp) setPillarLevelUp(result)
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

  /** `at` : horodatage explicite de la pause (LOT G2, Deep Focus) — le moteur à
   * timestamps l'utilise tel quel pour geler le temps écoulé à cet instant précis,
   * jamais à l'instant réel où cette fonction s'exécute (retour d'onglet, parfois bien
   * plus tard sur iOS qui gèle l'exécution JS en arrière-plan). Par défaut `Date.now()`,
   * comme avant, pour tout appelant qui ne passe rien (bouton Pause normal). */
  const pause = useCallback(
    (at?: number) => {
      void controller?.pause(at).then(refresh)
    },
    [controller, refresh],
  )

  const resume = useCallback(() => {
    void controller?.resume().then(refresh)
  }, [controller, refresh])

  const reset = useCallback(() => {
    void (async () => {
      if (controller) {
        const state = controller.getState()
        const liveSnapshot = controller.getSnapshot()
        if (state.startedAt !== null && liveSnapshot.status !== 'completed') {
          const result = await recordSession(state, Date.now(), false)
          if (result?.leveledUp) setPillarLevelUp(result)
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
    startedAt: controller?.getState().startedAt ?? null,
    cycle,
    snapshot,
    goalProgress,
    goalReached,
    continueAfterGoal,
    isSegmentSwitchBlocked: snapshot?.status === 'running' || snapshot?.status === 'paused',
    cycleEnded,
    sessionSummary,
    pillarLevelUp,
    endSession,
    acknowledgeSessionEnd,
    selectMode,
    selectSegment,
    start,
    pause,
    resume,
    reset,
    skip,
  }
}
