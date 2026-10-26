import { enqueueDelete, enqueueWrite } from '@/shared/sync/offline-queue'
import type { PillarRecord } from '@/shared/storage/db'
import { supabase } from '@/shared/supabase/client'

/**
 * current_xp/level sont volontairement absents de cette charge utile : seule la
 * fonction SQL recompute_pillar_xp() (déclenchée par un trigger sur focus_sessions,
 * voir supabase/migrations/0034_pillars.sql) les écrit. Un upsert qui les omettrait
 * laisse ces colonnes intactes côté serveur (`on conflict do update` ne touche que les
 * colonnes présentes dans la charge) — jamais écrasées par une valeur locale obsolète.
 */
function toRow(userId: string, pillar: PillarRecord) {
  return {
    id: pillar.id,
    user_id: userId,
    name: pillar.name,
    color: pillar.color,
    archived_at: pillar.archivedAt ? new Date(pillar.archivedAt).toISOString() : null,
    goal_level: pillar.goalLevel,
    goal_deadline: pillar.goalDeadline ? new Date(pillar.goalDeadline).toISOString() : null,
  }
}

export async function pushPillar(userId: string, pillar: PillarRecord): Promise<void> {
  await enqueueWrite('pillars', toRow(userId, pillar))
}

export async function deletePillarRemote(id: string): Promise<void> {
  await enqueueDelete('pillars', id)
}

export async function pullAllPillars(userId: string): Promise<PillarRecord[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('pillars').select('*').eq('user_id', userId)
  if (error || !data) return null

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    currentXp: row.current_xp,
    level: row.level,
    createdAt: new Date(row.created_at).getTime(),
    archivedAt: row.archived_at ? new Date(row.archived_at).getTime() : null,
    goalLevel: row.goal_level,
    goalDeadline: row.goal_deadline ? new Date(row.goal_deadline).getTime() : null,
  }))
}

/** Relit un seul pilier depuis le serveur (après une session enregistrée) pour
 * rafraîchir l'XP/niveau local sans attendre la prochaine connexion — le trigger côté
 * serveur a déjà eu le temps de tourner puisque cet appel suit l'upsert de la session
 * dans la même file (voir usePillars.ts, refreshPillarFromServer). */
export async function pullOnePillar(id: string): Promise<PillarRecord | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('pillars').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null

  return {
    id: data.id,
    name: data.name,
    color: data.color,
    currentXp: data.current_xp,
    level: data.level,
    createdAt: new Date(data.created_at).getTime(),
    archivedAt: data.archived_at ? new Date(data.archived_at).getTime() : null,
    goalLevel: data.goal_level,
    goalDeadline: data.goal_deadline ? new Date(data.goal_deadline).getTime() : null,
  }
}
