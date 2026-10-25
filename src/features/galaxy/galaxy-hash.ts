/**
 * Positions déterministes pour la Galaxie de nœuds (LOT G4) : la même session (même id)
 * doit toujours retomber exactement au même endroit, à chaque chargement, sur chaque
 * appareil — jamais une position tirée au hasard. On hache l'id (FNV-1a, rapide et bien
 * distribué pour des chaînes courtes) puis on en dérive deux flottants indépendants via
 * un PRNG déterministe (mulberry32) amorcé par ce hachage.
 */

function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface UnitPosition {
  /** Dans [0, 1). */
  x: number
  /** Dans [0, 1). */
  y: number
}

/** Position déterministe et stable pour une clé donnée (id de session, ou clé de
 * regroupement pour les étoiles agrégées au-delà du plafond). */
export function deterministicPosition(key: string): UnitPosition {
  const next = mulberry32(fnv1a(key))
  return { x: next(), y: next() }
}

/** Décimale déterministe supplémentaire dans [0, 1) — utilisée par exemple pour varier
 * légèrement la phase du scintillement d'une étoile sans dépendre de Math.random(). */
export function deterministicUnit(key: string): number {
  const next = mulberry32(fnv1a(key))
  return next()
}
