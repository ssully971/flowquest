import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'

import { notifySessionRecorded } from './session-events'

/**
 * Tire l'historique distant des sessions de `userId` et le fusionne dans IndexedDB (upsert
 * par id : une session déjà connue est réécrite à l'identique, jamais dupliquée). Aussi
 * appelée après une session de GROUPE (LOT M2/M3) : le serveur y enregistre lui-même les
 * focus_sessions de chaque participant (migration 0049), il faut donc les rapatrier pour
 * que les statistiques locales les voient sans rechargement.
 */
export async function pullRemoteFocusSessions(userId: string): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase.from('focus_sessions').select('*').eq('user_id', userId)
  if (error || !data || data.length === 0) return

  const db = await getDb()
  for (const row of data) {
    const record: FocusSessionRecord = {
      id: row.id,
      kind: row.kind,
      plannedSeconds: row.planned_seconds,
      actualSeconds: row.actual_seconds,
      startedAt: new Date(row.started_at).getTime(),
      endedAt: row.ended_at ? new Date(row.ended_at).getTime() : null,
      completed: row.completed,
      taskId: row.task_id,
      pillarId: row.pillar_id,
      syncedAt: Date.now(),
    }
    await db.put('focusSessions', record)
  }
  notifySessionRecorded()
}

/**
 * À la connexion, tire une fois l'historique distant des sessions et le fusionne dans
 * IndexedDB (upsert par id — une session déjà connue localement est simplement
 * réécrite à l'identique, jamais dupliquée). Permet aux statistiques de refléter les
 * sessions faites sur d'autres appareils une fois synchronisées.
 */
export function useSessionSync(): void {
  const { status, user } = useAuth()
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    if (status !== 'authenticated' || !user || !supabase) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    void pullRemoteFocusSessions(user.id)
  }, [status, user])
}
