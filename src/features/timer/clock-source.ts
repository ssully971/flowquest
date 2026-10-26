import type { ActiveGroupRoomValue } from '@/features/rooms/active-room-context'

import type { SegmentKind, TimerMode, TimerStatus } from './engine/timer-engine'
import { getDurationMsForMode } from './durations'
import { formatCountdown, formatElapsed } from './format'
import { toDurationsMs } from './timer-settings'
import type { TimerSettings } from './timer-settings'
import type { UseFocusTimerResult } from './useFocusTimer'

/**
 * Interface commune des deux sources d'horloge (LOT M3) : le minuteur PERSONNEL (moteur
 * local) et la session de GROUPE (état du salon côté serveur). L'écran Focus, l'écran
 * Ambiant, l'image dans l'image, le titre d'onglet, les citations de phase, le mode Deep
 * Focus et les raccourcis clavier ne lisent QUE cette interface : ils fonctionnent donc à
 * l'identique dans les deux cas, sans dupliquer la logique d'affichage.
 */
export interface ClockSource {
  kind: 'solo' | 'group'
  isReady: boolean
  mode: TimerMode
  segment: SegmentKind
  status: TimerStatus
  isStopwatch: boolean
  /** Temps affiché (compte à rebours, ou temps écoulé en Chrono). */
  displayLabel: string
  /** Avancement 0..1 de la phase (0 quand elle n'a pas de durée). */
  progress: number
  /** Identifie le DÉBUT d'une phase (change à chaque nouvelle phase) : clé des citations. */
  phaseKey: string | null
  /** Vrai quand cet appareil ne peut pas piloter l'horloge (participant non hôte). */
  readOnly: boolean
  /** Action principale : démarrer / mettre en pause / reprendre selon l'état. */
  onPrimary: () => void
  /** Met en pause (`at` : instant explicite, pour Deep Focus du minuteur personnel). */
  pause: (at?: number) => void
  resume: () => void
}

export function buildSoloClockSource(
  timer: UseFocusTimerResult,
  settings: TimerSettings,
): ClockSource {
  const snapshot = timer.snapshot
  const status = snapshot?.status ?? 'idle'
  const isStopwatch = timer.mode === 'stopwatch'
  const durationMs = getDurationMsForMode(
    timer.mode,
    timer.segment,
    toDurationsMs(settings),
    settings.countdownMinutes * 60_000,
  )
  return {
    kind: 'solo',
    isReady: timer.isReady && snapshot !== null,
    mode: timer.mode,
    segment: timer.segment,
    status,
    isStopwatch,
    displayLabel: isStopwatch
      ? formatElapsed(snapshot?.elapsedMs ?? 0)
      : formatCountdown(snapshot?.remainingMs ?? 0),
    progress:
      durationMs !== null && durationMs > 0 && snapshot
        ? Math.min(1, snapshot.elapsedMs / durationMs)
        : 0,
    phaseKey: timer.startedAt !== null ? `${timer.segment}:${timer.startedAt}` : null,
    readOnly: false,
    onPrimary: () => {
      if (status === 'running') timer.pause()
      else if (status === 'paused') timer.resume()
      else timer.start()
    },
    pause: timer.pause,
    resume: timer.resume,
  }
}

const ROOM_STATUS_TO_TIMER: Record<string, TimerStatus> = {
  lobby: 'idle',
  running: 'running',
  paused: 'paused',
  ended: 'completed',
}

/** Source d'horloge de la session de groupe active (`null` si aucune). */
export function buildGroupClockSource(group: ActiveGroupRoomValue): ClockSource | null {
  const { room, view, isHost, actions } = group
  if (!room || !view) return null
  const isStopwatch = room.mode === 'stopwatch'
  const segment: SegmentKind =
    room.mode === 'pomodoro' ? view.phase : room.mode === 'countdown' ? 'countdown' : 'stopwatch'
  const status = ROOM_STATUS_TO_TIMER[view.status] ?? 'idle'
  const started = view.status === 'running' || view.status === 'paused'

  return {
    kind: 'group',
    isReady: true,
    mode: room.mode,
    segment,
    status,
    isStopwatch,
    displayLabel:
      view.remainingMs !== null ? formatCountdown(view.remainingMs) : formatElapsed(view.elapsedMs),
    progress:
      view.durationMs !== null && view.durationMs > 0
        ? Math.min(1, view.elapsedMs / view.durationMs)
        : 0,
    phaseKey: started ? `${room.roomId}:${view.phaseIndex}` : null,
    readOnly: !isHost,
    onPrimary: () => {
      if (!isHost) return
      if (status === 'running') void actions.pause()
      else if (status === 'paused') void actions.resume()
      else void actions.start()
    },
    // Le salon se met en pause pour TOUT LE MONDE : seul l'hôte le peut (contrôlé aussi côté
    // serveur) ; Deep Focus n'appelle jamais ceci pour une session de groupe.
    pause: () => {
      if (isHost) void actions.pause()
    },
    resume: () => {
      if (isHost) void actions.resume()
    },
  }
}
