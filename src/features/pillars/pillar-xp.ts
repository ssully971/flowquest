/**
 * XP et niveau des Piliers de Vie (LOT G3). Reflète exactement la formule SQL de
 * supabase/migrations/0034_pillars.sql (pillar_level_for_xp, recompute_pillar_xp) :
 * ce module ne sert jamais de source de vérité pour un compte connecté (toujours
 * recomposée côté serveur depuis focus_sessions.actual_seconds), seulement à
 * - calculer l'XP en mode invité (aucun backend) ;
 * - mettre à jour l'affichage de façon optimiste juste après une session, avant que la
 *   prochaine synchronisation ne confirme la valeur serveur.
 */

/** 1 min de focus réel = 10 XP. */
export const XP_PER_MINUTE = 10

/** XP gagnée pour une durée réelle de focus donnée (floor, jamais arrondi au-dessus —
 * un Pomodoro arrêté à 18 min donne l'XP de 18 min, pas de la durée prévue). */
export function xpForActualSeconds(actualSeconds: number): number {
  return Math.floor((Math.max(0, actualSeconds) * XP_PER_MINUTE) / 60)
}

/** XP cumulée nécessaire pour atteindre un niveau donné (niveau 1 = 0 XP) : passer du
 * niveau L à L+1 coûte 600·(L+1) XP, somme télescopique = 300·(L-1)·L. */
export function xpToReachLevel(level: number): number {
  return 300 * (level - 1) * level
}

/** Niveau atteint pour une XP cumulée donnée (forme fermée de 300·(L-1)·L <= xp). */
export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (2 * Math.max(0, xp)) / 150)) / 2))
}

export interface PillarLevelProgress {
  level: number
  /** XP déjà acquise dans le niveau en cours. */
  xpInLevel: number
  /** XP totale requise pour passer au niveau suivant (jamais 0). */
  xpForNextLevel: number
}

export function levelProgressForXp(xp: number): PillarLevelProgress {
  const level = levelForXp(xp)
  const xpInLevel = xp - xpToReachLevel(level)
  const xpForNextLevel = xpToReachLevel(level + 1) - xpToReachLevel(level)
  return { level, xpInLevel, xpForNextLevel }
}
