import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'

import { notifySessionRecorded } from './session-events'

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

    void (async () => {
      if (!supabase) return
      const { data, error } = await supabase
        .from('focus_sessions')
        .select('*')
        .eq('user_id', user.id)
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
    })()
  }, [status, user])
}
