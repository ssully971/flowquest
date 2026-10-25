import { deterministicUnit } from './galaxy-hash'

/**
 * Disposition en spirale de la Galaxie (lot 4, §3) : un bras par pilier, régulièrement
 * répartis (createArmAngleResolver), chaque étoile placée le long de son bras à rayon
 * croissant selon l'ordre chronologique (spiralStarPosition) — jamais un placement
 * pseudo-aléatoire comme avant ce lot. Limite assumée : la distance minimale entre deux
 * étoiles n'est garantie par construction qu'à l'intérieur d'un peu moins d'un tour de
 * spirale par bras (~45 sessions, voir galaxy-layout.test.ts) ; au-delà, l'angle finit
 * par repasser près d'une position déjà occupée lors d'un tour précédent, avec un risque
 * de rapprochement visuel pour un pilier utilisé de façon extrême (plusieurs centaines de
 * sessions). Strictement meilleur que l'ancien hachage pseudo-aléatoire (aucune garantie,
 * quel que soit le nombre de sessions), jamais pire.
 */
export interface UnitPosition {
  /** Dans [0, 1). */
  x: number
  /** Dans [0, 1). */
  y: number
}

// Rayon (en unités [0,1), centre à 0.5/0.5 — voir toPixel dans GalaxyCanvas) de la
// première étoile d'un bras, puis pas radial entre deux étoiles consécutives du même
// bras. À la taille d'affichage habituelle de la Galaxie (conteneur ~400px, voir
// GalaxyView), 0.05 * 400px = 20px de pas — même en retranchant le pire cas de décalage
// opposé (JITTER_RADIUS_UNIT des deux étoiles jouant l'une contre l'autre), il reste au
// moins 0.05 - 2*JITTER_RADIUS_UNIT ≈ 16px, plus que le diamètre de deux étoiles à leur
// rayon maximal (7.5px, voir MAX_RADIUS dans build-galaxy-data.ts → 15px) : la distance
// minimale garantie tient même dans ce cas peu probable (deux sessions consécutives
// toutes deux à la durée maximale). Une fois le rayon plafonné à MAX_RADIUS_UNIT (bras
// très ancien), seul l'écart angulaire sépare encore les étoiles (voir plus bas) — un bras
// de plusieurs centaines de sessions finit par orbiter, de plus en plus densément, sur
// l'anneau extérieur plutôt que de continuer à s'étendre indéfiniment ; limitation
// acceptée, comme le plafond global MAX_INDIVIDUAL_STARS déjà existant.
const MIN_RADIUS_UNIT = 0.05
const RADIAL_STEP_UNIT = 0.05
const MAX_RADIUS_UNIT = 0.47

// Avance angulaire d'une étoile à la suivante sur le même bras (lot 4, §3) : c'est ce qui
// fait « spiraler » le bras au lieu de rester un rayon droit — comme les bras d'une vraie
// galaxie spirale, qui s'enroulent en s'éloignant du centre. Une fois le rayon plafonné à
// MAX_RADIUS_UNIT (bras très ancien, beaucoup de sessions), les étoiles continuent
// d'avancer en angle : elles finissent par orbiter sur l'anneau extérieur plutôt que de
// s'empiler toutes au même endroit.
const ARM_WIND_RADIANS_PER_STAR = 0.12

// Décalage borné et déterministe (lot 4, §3 : « un très léger décalage borné et
// déterministe pour un aspect naturel ») : une fraction du pas radial / de l'avance
// angulaire, jamais assez pour qu'une étoile rattrape sa voisine ou déborde sur le bras
// suivant.
const JITTER_RADIUS_UNIT = RADIAL_STEP_UNIT * 0.1
// Volontairement une petite fraction de l'avance angulaire : une fois le rayon plafonné
// (bras saturé, voir MAX_RADIUS_UNIT), l'écart angulaire est le SEUL mécanisme qui sépare
// encore deux étoiles consécutives (rayon identique pour les deux) — un décalage trop
// généreux pourrait annuler cet écart dans le pire cas et faire se toucher deux étoiles.
const JITTER_ANGLE_RADIANS = ARM_WIND_RADIANS_PER_STAR * 0.1

function baseArmAngle(armIndex: number, armCount: number): number {
  // Démarre en haut (-90°), comme les axes du radar de la carte Équilibre
  // (BalanceCard.axisPoint) — cohérence visuelle entre les deux représentations des
  // mêmes piliers.
  return -Math.PI / 2 + (2 * Math.PI * armIndex) / armCount
}

/**
 * Attribution stable d'un bras par pilier (lot 4, §3) : l'angle d'un pilier dépend de son
 * rang dans `pillarIds` (l'ordre complet connu du compte, piliers archivés compris — pas
 * seulement ceux visibles dans la vue filtrée actuelle), jamais du sous-ensemble de
 * sessions affiché à l'instant T. Un pilier garde ainsi le même bras que la vue soit
 * filtrée sur lui seul ou sur tous les piliers. Le bras gris (sessions sans pilier, ou
 * dont le pilier référencé n'existe plus) occupe toujours le dernier emplacement.
 */
export function createArmAngleResolver(pillarIds: string[]): (pillarId: string | null) => number {
  const armCount = pillarIds.length + 1
  const greyArmAngle = baseArmAngle(armCount - 1, armCount)
  return (pillarId: string | null): number => {
    if (pillarId !== null) {
      const index = pillarIds.indexOf(pillarId)
      if (index !== -1) return baseArmAngle(index, armCount)
    }
    return greyArmAngle
  }
}

/**
 * Position d'une étoile le long de son bras (lot 4, §3) : rayon croissant avec
 * `indexAlongArm` (l'appelant trie ses étoiles par ordre chronologique avant d'appeler
 * cette fonction — la plus ancienne en premier, donc au centre), angle qui avance
 * légèrement à chaque étoile (la spirale), et un décalage borné et déterministe dérivé de
 * `jitterKey` (l'id de la session, ou la clé de regroupement d'une étoile agrégée) pour un
 * aspect naturel — jamais Math.random(), le rendu reste identique à chaque ouverture.
 */
export function spiralStarPosition(
  armAngle: number,
  indexAlongArm: number,
  jitterKey: string,
): UnitPosition {
  const radius = Math.min(MAX_RADIUS_UNIT, MIN_RADIUS_UNIT + RADIAL_STEP_UNIT * indexAlongArm)
  const angle = armAngle + indexAlongArm * ARM_WIND_RADIANS_PER_STAR

  const radiusJitter = (deterministicUnit(`${jitterKey}:spiral-r`) - 0.5) * 2 * JITTER_RADIUS_UNIT
  const angleJitter = (deterministicUnit(`${jitterKey}:spiral-a`) - 0.5) * 2 * JITTER_ANGLE_RADIANS

  const jitteredRadius = Math.max(0, radius + radiusJitter)
  const jitteredAngle = angle + angleJitter

  return {
    x: 0.5 + jitteredRadius * Math.cos(jitteredAngle),
    y: 0.5 + jitteredRadius * Math.sin(jitteredAngle),
  }
}
