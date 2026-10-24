import { supabase } from '@/shared/supabase/client'
import type { LiveState } from '@/shared/supabase/database.types'

export class LiveStatusError extends Error {}

/** Écrit (upsert) sa propre ligne live_status — politique RLS self-only (migration
 * 0025_live_status.sql), aucune règle métier complexe, donc pas besoin de RPC ici
 * (contrairement à friendships/cheers). */
export async function upsertLiveStatus(
  userId: string,
  state: LiveState,
  startedAt: number | null,
  durationMs: number | null,
): Promise<void> {
  if (!supabase) throw new LiveStatusError('Supabase non configuré')
  const { error } = await supabase.from('live_status').upsert({
    user_id: userId,
    state,
    started_at: startedAt !== null ? new Date(startedAt).toISOString() : null,
    duration_ms: durationMs,
  })
  if (error) throw new LiveStatusError(error.message)
}
