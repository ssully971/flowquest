import { enqueueWrite } from '@/shared/sync/offline-queue'
import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

import type { TimerState } from '../engine/timer-engine'

export interface RemoteTimerState {
  state: TimerState
  updatedAt: number
}

function toRow(
  userId: string,
  state: TimerState,
  updatedAt: number,
): Database['public']['Tables']['timer_state']['Insert'] {
  return {
    user_id: userId,
    mode: state.mode,
    segment: state.segment,
    status: state.status,
    started_at: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    paused_at: state.pausedAt ? new Date(state.pausedAt).toISOString() : null,
    duration_ms: state.durationMs,
    paused_total_ms: state.pausedTotalMs,
    updated_at: new Date(updatedAt).toISOString(),
  }
}

/**
 * Lit l'état distant du minuteur (si connecté). N'écrit jamais directement en base :
 * les écritures passent par la file d'attente hors ligne (enqueueWrite).
 */
export class SupabaseTimerStateRepository {
  async load(userId: string): Promise<RemoteTimerState | null> {
    if (!supabase) return null
    const { data, error } = await supabase
      .from('timer_state')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null

    const state: TimerState = {
      mode: data.mode,
      segment: data.segment,
      durationMs: data.duration_ms,
      startedAt: data.started_at ? new Date(data.started_at).getTime() : null,
      pausedAt: data.paused_at ? new Date(data.paused_at).getTime() : null,
      pausedTotalMs: data.paused_total_ms,
      status: data.status,
    }
    return { state, updatedAt: new Date(data.updated_at).getTime() }
  }

  async save(userId: string, state: TimerState, updatedAt: number): Promise<void> {
    await enqueueWrite('timer_state', toRow(userId, state, updatedAt))
  }
}
