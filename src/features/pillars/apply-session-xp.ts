import type { PillarRecord } from '@/shared/storage/db'

import { notifyPillarsChanged } from './pillar-events'
import { levelForXp, xpForActualSeconds } from './pillar-xp'
import { IndexedDbPillarRepository } from './storage/indexed-db-pillar-repository'
import { pullOnePillar } from './storage/supabase-pillar-sync'

const repo = new IndexedDbPillarRepository()

export interface PillarXpResult {
  pillarId: string
  pillarName: string
  previousLevel: number
  newLevel: number
  leveledUp: boolean
  /** Vrai seulement la session qui fait franchir le niveau visé (lot 4, §4) — jamais à
   * nouveau les sessions suivantes, même si l'objectif reste atteint : on compare le
   * niveau AVANT et APRÈS cette session précise contre `goalLevel`, pas juste « est-ce que
   * le niveau actuel est ≥ l'objectif ». */
  goalReached: boolean
  goalLevel: number | null
}

/**
 * Met à jour l'XP/niveau LOCAL d'un pilier juste après une session, de façon optimiste
 * (réactivité immédiate du sélecteur/bilan) — jamais la source de vérité pour un compte
 * connecté : `reconcilePillarFromServer` la corrige dès que le trigger SQL
 * recompute_pillar_xp() a tourné (voir supabase/migrations/0034_pillars.sql). En mode
 * invité, ce calcul local EST la seule source de vérité, il n'y a pas de serveur.
 */
export async function applySessionXp(
  pillarId: string,
  actualSeconds: number,
): Promise<PillarXpResult | null> {
  const current = await repo.listAll()
  const pillar = current.find((item) => item.id === pillarId)
  if (!pillar) return null

  const gainedXp = xpForActualSeconds(actualSeconds)
  const newXp = pillar.currentXp + gainedXp
  const newLevel = levelForXp(newXp)
  const updated: PillarRecord = { ...pillar, currentXp: newXp, level: newLevel }
  await repo.put(updated)
  notifyPillarsChanged()

  const goalLevel = pillar.goalLevel
  const goalReached = goalLevel !== null && pillar.level < goalLevel && newLevel >= goalLevel

  return {
    pillarId,
    pillarName: pillar.name,
    previousLevel: pillar.level,
    newLevel,
    leveledUp: newLevel > pillar.level,
    goalReached,
    goalLevel,
  }
}

/** Relit le pilier depuis Supabase pour corriger l'estimation optimiste ci-dessus une
 * fois la vraie valeur serveur disponible (voir supabase-pillar-sync.ts). Sans effet en
 * mode invité (pullOnePillar renvoie alors null). */
export async function reconcilePillarFromServer(pillarId: string): Promise<void> {
  const remote = await pullOnePillar(pillarId)
  if (!remote) return
  await repo.put(remote)
  notifyPillarsChanged()
}
