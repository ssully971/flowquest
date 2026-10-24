/** Palette fixe (même esprit que la marque, pas un arc-en-ciel générique — voir
 * src/features/tasks/confetti.ts) : l'avatar par défaut d'un compte donné utilise toujours
 * la même couleur, choisie par hachage de son identifiant. */
const PALETTE = [
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#EC4899',
  '#F43F5E',
  '#06B6D4',
  '#84CC16',
]

/** Hachage simple et stable (pas cryptographique, juste déterministe) : même graine =
 * même couleur, toujours. */
export function colorForIdentity(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return PALETTE[hash % PALETTE.length]
}

/** Initiales affichées sur l'avatar par défaut : deux premières lettres du nom affiché
 * (ou du pseudo à défaut), ou les deux premiers mots s'il y en a plusieurs. Jamais vide :
 * si les deux sont vides (ne devrait jamais arriver, username est requis en base), un
 * point d'interrogation plutôt qu'une case blanche. */
export function initialsForIdentity(displayName: string | null | undefined, username: string): string {
  const source = (displayName?.trim() || username || '').trim()
  if (!source) return '?'
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}
