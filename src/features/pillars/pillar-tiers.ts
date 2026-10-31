/**
 * Titres et paliers visuels des piliers (lot 6A). Un pilier gagne un TITRE et un badge à
 * certains niveaux ; le palier pilote aussi l'apparence de son étoile dans la constellation
 * (taille, halo, nombre de branches). Fonction pure du niveau : jamais stocké.
 */
export type PillarTierId =
  'novice' | 'initie' | 'apprenti' | 'adepte' | 'expert' | 'maitre' | 'legende'

export interface PillarTier {
  id: PillarTierId
  /** Premier niveau du palier (inclus). */
  minLevel: number
  /** Position du palier, de 0 (Novice) à 6 (Légende). */
  index: number
  /** Apparence de l'étoile du pilier dans la constellation. */
  star: {
    /** Multiplicateur du rayon de base. */
    scale: number
    /** Intensité du halo, de 0 (aucun) à 1. */
    halo: number
    /** Nombre de branches de l'étoile (4, 5, 6 ou 8). */
    points: number
  }
}

export const PILLAR_TIERS: readonly PillarTier[] = [
  { id: 'novice', minLevel: 1, index: 0, star: { scale: 1, halo: 0, points: 4 } },
  { id: 'initie', minLevel: 3, index: 1, star: { scale: 1.15, halo: 0.15, points: 4 } },
  { id: 'apprenti', minLevel: 5, index: 2, star: { scale: 1.3, halo: 0.3, points: 5 } },
  { id: 'adepte', minLevel: 8, index: 3, star: { scale: 1.5, halo: 0.45, points: 5 } },
  { id: 'expert', minLevel: 12, index: 4, star: { scale: 1.7, halo: 0.6, points: 6 } },
  { id: 'maitre', minLevel: 18, index: 5, star: { scale: 1.95, halo: 0.8, points: 6 } },
  { id: 'legende', minLevel: 25, index: 6, star: { scale: 2.2, halo: 1, points: 8 } },
]

/** Palier atteint pour un niveau de pilier donné (niveau < 1 traité comme 1). */
export function tierForLevel(level: number): PillarTier {
  let current = PILLAR_TIERS[0]
  for (const tier of PILLAR_TIERS) if (level >= tier.minLevel) current = tier
  return current
}

/** Palier suivant, ou `null` au palier maximal. */
export function nextTier(level: number): PillarTier | null {
  return PILLAR_TIERS.find((tier) => tier.minLevel > level) ?? null
}
