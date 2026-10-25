import { getCurrentUserId } from '@/features/auth/current-user'
import { getActivePillarId } from '@/features/pillars/active-pillar-ref'
import { applySessionXp, reconcilePillarFromServer } from '@/features/pillars/apply-session-xp'
import type { PillarXpResult } from '@/features/pillars/apply-session-xp'
import { notifySessionRecorded } from '@/features/stats/session-events'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { enqueueWrite } from '@/shared/sync/offline-queue'

import { getSnapshot } from './engine/timer-engine'
import type { SegmentKind, TimerState } from './engine/timer-engine'
import { IndexedDbFocusSessionRepository } from './storage/focus-session-repository'

const localRepo = new IndexedDbFocusSessionRepository()

type RecordableSegment = 'focus' | 'short_break' | 'long_break'

function isRecordableSegment(segment: SegmentKind): segment is RecordableSegment {
  return segment === 'focus' || segment === 'short_break' || segment === 'long_break'
}

/**
 * Enregistre une session (terminée naturellement ou abandonnée) dans l'historique
 * local, et la pousse vers Supabase si connecté. N'enregistre rien pour un segment
 * jamais démarré, ni pour compte à rebours / chronomètre libre (hors périmètre des
 * statistiques de base — §9 porte sur les cycles pomodoro).
 */
export async function recordSession(
  state: TimerState,
  endedAt: number,
  completed: boolean,
): Promise<PillarXpResult | null> {
  if (state.startedAt === null) return null
  if (!isRecordableSegment(state.segment)) return null

  // Réutilise le calcul du moteur (getSnapshot/getElapsedMs) plutôt que de reproduire sa
  // propre formule (LOT E7) : seule cette fonction sait déjà gérer correctement le cas
  // d'un arrêt pendant que la session est en pause — elle s'arrête alors à `pausedAt`,
  // pas à `endedAt` (sans quoi tout le temps passé en pause, même très long, aurait été
  // compté à tort comme du temps de travail réel).
  const actualSeconds = Math.round(getSnapshot(state, endedAt).elapsedMs / 1000)
  const plannedSeconds = state.durationMs ? Math.round(state.durationMs / 1000) : actualSeconds

  // Un pilier ne s'attache qu'aux segments de focus (LOT G3) : seuls eux comptent pour
  // l'XP (recompute_pillar_xp filtre déjà kind = 'focus' côté serveur), inutile de
  // rattacher un pilier à une pause.
  const pillarId = state.segment === 'focus' ? getActivePillarId() : null

  const record: FocusSessionRecord = {
    id: crypto.randomUUID(),
    kind: state.segment,
    plannedSeconds,
    actualSeconds,
    startedAt: state.startedAt,
    endedAt,
    completed,
    taskId: null,
    pillarId,
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
    })
    if (pillarId) void reconcilePillarFromServer(pillarId)
  }

  return pillarXpResult
}
