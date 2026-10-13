import { getCurrentUserId } from '@/features/auth/current-user'
import { notifySessionRecorded } from '@/features/stats/session-events'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { enqueueWrite } from '@/shared/sync/offline-queue'

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
): Promise<void> {
  if (state.startedAt === null) return
  if (!isRecordableSegment(state.segment)) return

  const actualSeconds = Math.max(
    0,
    Math.round((endedAt - state.startedAt - state.pausedTotalMs) / 1000),
  )
  const plannedSeconds = state.durationMs ? Math.round(state.durationMs / 1000) : actualSeconds

  const record: FocusSessionRecord = {
    id: crypto.randomUUID(),
    kind: state.segment,
    plannedSeconds,
    actualSeconds,
    startedAt: state.startedAt,
    endedAt,
    completed,
    taskId: null,
    syncedAt: null,
  }

  await localRepo.add(record)
  notifySessionRecorded()

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
    })
  }
}
