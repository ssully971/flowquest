export const TALLY_ICON_SETS = [
  'dots',
  'stars',
  'flames',
  'leaves',
  'coffee',
  'stethoscope',
  'hearts',
  'pills',
] as const

export type TallyIconSet = (typeof TALLY_ICON_SETS)[number]

/**
 * Émojis couleur natifs par jeu (§20.7 — inspiration docs/reference/session-tallies,
 * ergonomie seulement). La plupart répètent le même émoji ; « leaves » et le jeu
 * médical sont une progression thématique (comme « Growing Tree » dans la référence).
 * Répété en boucle (index % longueur) si le nombre de sessions dépasse la longueur du
 * jeu — voir SessionTally.
 */
export const TALLY_EMOJI: Record<Exclude<TallyIconSet, 'dots'>, string[]> = {
  stars: ['⭐'],
  flames: ['🔥'],
  leaves: ['🌱', '🌿', '🍃', '🌳'],
  coffee: ['☕'],
  stethoscope: ['🩺', '❤️', '💊', '🧠', '🦷', '🫁'],
  hearts: ['❤️'],
  pills: ['💊'],
}
