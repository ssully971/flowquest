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

const DAY_MS = 24 * 60 * 60 * 1000

/** XP restante pour atteindre un niveau visé (lot 4, §4), jamais négative — un objectif
 * déjà dépassé n'a plus d'XP restante à gagner. */
export function xpRemainingForGoal(currentXp: number, goalLevel: number): number {
  return Math.max(0, xpToReachLevel(goalLevel) - currentXp)
}

/** Progression (0 à 1) vers un objectif de niveau, mesurée depuis le niveau où l'objectif
 * a commencé à compter (niveau courant au moment où il a été fixé n'est pas connu ici —
 * on mesure depuis le niveau 1, cohérent avec `xpToReachLevel`, en bornant à 1 une fois
 * l'objectif atteint). */
export function goalProgressRatio(currentXp: number, goalLevel: number): number {
  const target = xpToReachLevel(goalLevel)
  if (target <= 0) return 1
  return Math.min(1, currentXp / target)
}

export interface GoalPace {
  /** Toujours ≥ 0. */
  xpRemaining: number
  /** Temps de focus réel restant pour combler `xpRemaining`, en secondes. */
  secondsRemaining: number
  /** `null` si aucune date limite n'est fixée. Négatif si la date limite est déjà
   * dépassée (et l'objectif pas encore atteint). */
  daysUntilDeadline: number | null
  /** Temps de focus moyen par jour nécessaire pour atteindre l'objectif avant sa date
   * limite, en secondes — `null` si aucune date limite, ou si elle est déjà dépassée
   * (voir `daysUntilDeadline`, alors ≤ 0). */
  averageSecondsPerDayNeeded: number | null
}

/** Rythme nécessaire pour atteindre un objectif de niveau (lot 4, §4) : XP/temps restant,
 * et — si une date limite est fixée — le temps de focus moyen par jour nécessaire pour
 * l'atteindre à temps. `nowMs` est un paramètre explicite (jamais `Date.now()` lu en
 * interne) pour rester une fonction pure, testable sans horloge système. */
export function goalPace(
  currentXp: number,
  goalLevel: number,
  deadlineMs: number | null,
  nowMs: number,
): GoalPace {
  const xpRemaining = xpRemainingForGoal(currentXp, goalLevel)
  const secondsRemaining = (xpRemaining / XP_PER_MINUTE) * 60

  if (deadlineMs === null) {
    return {
      xpRemaining,
      secondsRemaining,
      daysUntilDeadline: null,
      averageSecondsPerDayNeeded: null,
    }
  }

  const daysUntilDeadline = (deadlineMs - nowMs) / DAY_MS
  if (xpRemaining === 0 || daysUntilDeadline <= 0) {
    return { xpRemaining, secondsRemaining, daysUntilDeadline, averageSecondsPerDayNeeded: null }
  }

  return {
    xpRemaining,
    secondsRemaining,
    daysUntilDeadline,
    averageSecondsPerDayNeeded: secondsRemaining / daysUntilDeadline,
  }
}
