export type QuoteCategory = 'medicine' | 'focus'
export type QuoteRotation = 'daily' | 'everyLoad'

export interface Quote {
  text: string
  author: string
  category: QuoteCategory
}

/**
 * Liste de départ (§7.5 et §20.6 du cahier des charges : citation de départ "La vie est
 * brève, l'art est long." d'Hippocrate, les suivantes doivent à terme venir de l'admin —
 * hors périmètre de cette phase, gérée côté client pour l'instant). Chaque citation est
 * soit solidement attestée avec son auteur, soit un proverbe anonyme : rien n'est
 * attribué à une personne sans confirmation raisonnable, pour éviter les citations
 * apocryphes qui circulent beaucoup sur ce type de thème.
 */
export const QUOTES: Quote[] = [
  { text: 'La vie est brève, l’art est long.', author: 'Hippocrate', category: 'medicine' },
  {
    text: 'Il n’y a pas de maladies, il n’y a que des malades.',
    author: 'Armand Trousseau',
    category: 'medicine',
  },
  { text: 'D’abord, ne pas nuire.', author: 'Tradition hippocratique', category: 'medicine' },
  {
    text: 'La médecine est une science de l’incertitude et un art de la probabilité.',
    author: 'William Osler',
    category: 'medicine',
  },
  {
    text: 'La chance ne sourit qu’aux esprits bien préparés.',
    author: 'Louis Pasteur',
    category: 'medicine',
  },
  { text: 'Mieux vaut prévenir que guérir.', author: 'Proverbe', category: 'medicine' },
  {
    text: 'Ce n’est pas que nous ayons peu de temps, mais nous en perdons beaucoup.',
    author: 'Sénèque',
    category: 'focus',
  },
  {
    text: 'Tu as le pouvoir sur ton esprit, non sur les événements extérieurs.',
    author: 'Marc Aurèle',
    category: 'focus',
  },
  {
    text: 'Un voyage de mille lieues commence toujours par un premier pas.',
    author: 'Lao-Tseu',
    category: 'focus',
  },
  {
    text: 'La perfection est atteinte, non pas lorsqu’il n’y a plus rien à ajouter, mais lorsqu’il n’y a plus rien à retirer.',
    author: 'Antoine de Saint-Exupéry',
    category: 'focus',
  },
  { text: 'Petit à petit, l’oiseau fait son nid.', author: 'Proverbe', category: 'focus' },
  {
    text: 'Celui qui déplace une montagne commence par déplacer de petites pierres.',
    author: 'Proverbe chinois',
    category: 'focus',
  },
]

// `pool` par défaut à QUOTES (le tableau statique) pour tout appelant qui n'en fournit pas :
// `useQuotePool()` passe à terme le pool géré par le panneau Admin (§12) quand il est chargé,
// avec repli automatique sur QUOTES si la base est vide, non configurée ou en erreur.
function quotesForCategory(category: QuoteCategory | 'all', pool: Quote[] = QUOTES): Quote[] {
  const filtered = category === 'all' ? pool : pool.filter((quote) => quote.category === category)
  return filtered.length > 0 ? filtered : pool
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diffMs = date.getTime() - start.getTime()
  return Math.floor(diffMs / 86_400_000)
}

/** Déterministe : la même citation toute la journée, change au jour suivant. */
export function pickDailyQuote(
  category: QuoteCategory | 'all',
  now: Date = new Date(),
  pool: Quote[] = QUOTES,
): Quote {
  const filtered = quotesForCategory(category, pool)
  return filtered[dayOfYear(now) % filtered.length]
}

/**
 * Aléatoire : une nouvelle citation à chaque appel (typiquement à chaque chargement, ou à
 * chaque début de phase sur l'écran Focus — LOT G1, voir usePhaseQuote). `exclude` évite
 * de retomber sur la citation déjà affichée (jamais de répétition immédiate) — ignoré si
 * le pool filtré n'a qu'une seule citation, pour ne pas boucler indéfiniment.
 */
export function pickRandomQuote(
  category: QuoteCategory | 'all',
  pool: Quote[] = QUOTES,
  exclude: Quote | null = null,
): Quote {
  const filtered = quotesForCategory(category, pool)
  const candidates =
    exclude && filtered.length > 1 ? filtered.filter((quote) => quote.text !== exclude.text) : filtered
  return candidates[Math.floor(Math.random() * candidates.length)]
}
