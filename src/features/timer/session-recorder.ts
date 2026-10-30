import { getCurrentUserId } from '@/features/auth/current-user'
import { getActivePillarId } from '@/features/pillars/active-pillar-ref'
import { applySessionXp, reconcilePillarFromServer } from '@/features/pillars/apply-session-xp'
import type { PillarXpResult } from '@/features/pillars/apply-session-xp'
import { getPillarsEnabled } from '@/features/settings/pillars-enabled-ref'
import { notifySessionRecorded } from '@/features/stats/session-events'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { enqueueWrite } from '@/shared/sync/offline-queue'

import { getPausedMs, getSnapshot } from './engine/timer-engine'
import type { SegmentKind, TimerState } from './engine/timer-engine'
import { IndexedDbFocusSessionRepository } from './storage/focus-session-repository'

const localRepo = new IndexedDbFocusSessionRepository()

/** Sous ce temps de focus, terminer à la main n'enregistre rien (clic accidentel, essai) :
 * aucun seuil n'existait avant ; voir `endSession` (useFocusTimer). */
export const MIN_RECORDED_SECONDS = 60

/** Genre enregistré d'une phase : le Chrono et le Minuteur sont du temps de FOCUS réel (comme
 * dans les salons, migration 0049) ; `null` pour une phase qui ne s'enregistre pas. */
function recordedKind(segment: SegmentKind): FocusSessionRecord['kind'] | null {
  if (segment === 'focus' || segment === 'countdown' || segment === 'stopwatch') return 'focus'
  if (segment === 'short_break' || segment === 'long_break') return segment
  return null
}

/**
 * Enregistre une session (terminée naturellement ou abandonnée) dans l'historique
 * local, et la pousse vers Supabase si connecté. N'enregistre rien pour un segment
 * jamais démarré. Le Chrono et le Minuteur comptent comme du focus (kind `focus`).
 */
export async function recordSession(
  state: TimerState,
  endedAt: number,
  completed: boolean,
): Promise<PillarXpResult | null> {
  if (state.startedAt === null) return null
  const kind = recordedKind(state.segment)
  if (kind === null) return null

  // Réutilise le calcul du moteur (getSnapshot/getElapsedMs) plutôt que de reproduire sa
  // propre formule (LOT E7) : seule cette fonction sait déjà gérer correctement le cas
  // d'un arrêt pendant que la session est en pause — elle s'arrête alors à `pausedAt`,
  // pas à `endedAt` (sans quoi tout le temps passé en pause, même très long, aurait été
  // compté à tort comme du temps de travail réel).
  const actualSeconds = Math.round(getSnapshot(state, endedAt).elapsedMs / 1000)
  const plannedSeconds = state.durationMs ? Math.round(state.durationMs / 1000) : actualSeconds

  // Un pilier ne s'attache qu'aux segments de focus (LOT G3) : seuls eux comptent pour
  // l'XP (recompute_pillar_xp filtre déjà kind = 'focus' côté serveur), inutile de
  // rattacher un pilier à une pause. Piliers désactivés (lot 4, §5) : la session
  // s'enregistre normalement, juste sans pilier — même si un pilier était resté actif
  // dans active-pillar-ref avant la désactivation.
  const pillarId = kind === 'focus' && getPillarsEnabled() ? getActivePillarId() : null
  // Temps de pause (manuelles + absence après la garde de 4 h) et nombre de pauses manuelles.
  const pausedSeconds = Math.round(getPausedMs(state, endedAt) / 1000)
  const pauseCount = state.pauseCount ?? 0

  const record: FocusSessionRecord = {
    id: crypto.randomUUID(),
    kind,
    plannedSeconds,
    actualSeconds,
    startedAt: state.startedAt,
    endedAt,
    completed,
    taskId: null,
    pillarId,
    pausedSeconds,
    pauseCount,
    syncedAt: null,
  }

  await localRepo.add(record)
  notifySessionRecorded()

  const pillarXpResult = pillarId ? await applySessionXp(pillarId, actualSeconds) : null

  const userId = getCurrentUserId()
  if (userId) {
    await enqueueWrite('focus_sessions', {
      id: record.id,
      user_id: userId,
      kind: record.kind,
      planned_seconds: record.plannedSeconds,
      actual_seconds: record.actualSeconds,
      started_at: new Date(record.startedAt).toISOString(),
      ended_at: new Date(endedAt).toISOString(),
      completed: record.completed,
      pillar_id: pillarId,
      paused_seconds: record.pausedSeconds,
      pause_count: record.pauseCount,
    })
    if (pillarId) void reconcilePillarFromServer(pillarId)
  }

  return pillarXpResult
}
