import { getDb } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'

import { startOfDay } from './compute-stats'
import type { FreezeState } from './streak-freezes'

const RECORD_KEY = 'streakFreezes'
const SCHEMA_VERSION = 1

/** État des gels d'un invité (IndexedDB, store `settings`) — `null` tant que rien n'est stocké. */
export async function loadLocalFreezeState(): Promise<FreezeState | null> {
  const db = await getDb()
  const record = await db.get('settings', RECORD_KEY)
  if (!record) return null
  return record.data as unknown as FreezeState
}

export async function saveLocalFreezeState(state: FreezeState): Promise<void> {
  const db = await getDb()
  await db.put(
    'settings',
    {
      schemaVersion: SCHEMA_VERSION,
      data: state as unknown as Record<string, unknown>,
      updatedAt: Date.now(),
    },
    RECORD_KEY,
  )
}

interface FreezeRpcPayload {
  stock: number
  accounted_seconds: number
  alive: boolean
  processed_through: string
  used_days: string[]
}

/** 'YYYY-MM-DD' (jour du profil côté serveur) → minuit LOCAL de ce même jour calendaire. */
function dateKeyToLocalDay(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number)
  return startOfDay(new Date(year, month - 1, day).getTime())
}

/**
 * Compte connecté : le serveur est la source de vérité. La RPC rejoue les jours écoulés
 * (idempotente, sûre en multi-appareils, migration 0054) et renvoie l'état à jour.
 * `null` si Supabase est absent ou injoignable : l'appelant retombe sur « pas de gel ».
 */
export async function syncRemoteFreezeState(dailyGoalMinutes: number): Promise<FreezeState | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('sync_streak_freezes', {
    p_goal_minutes: dailyGoalMinutes,
  })
  if (error || !data) return null
  const payload = data as unknown as FreezeRpcPayload
  return {
    processedThrough: dateKeyToLocalDay(payload.processed_through),
    stock: payload.stock,
    accountedSeconds: payload.accounted_seconds,
    alive: payload.alive,
    usedDays: payload.used_days.map(dateKeyToLocalDay),
  }
}
