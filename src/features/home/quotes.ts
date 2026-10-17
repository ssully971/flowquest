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

function quotesForCategory(category: QuoteCategory | 'all'): Quote[] {
  const pool = category === 'all' ? QUOTES : QUOTES.filter((quote) => quote.category === category)
  return pool.length > 0 ? pool : QUOTES
}

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diffMs = date.getTime() - start.getTime()
  return Math.floor(diffMs / 86_400_000)
}

/** Déterministe : la même citation toute la journée, change au jour suivant. */
export function pickDailyQuote(category: QuoteCategory | 'all', now: Date = new Date()): Quote {
  const pool = quotesForCategory(category)
  return pool[dayOfYear(now) % pool.length]
}

/** Aléatoire : une nouvelle citation à chaque appel (typiquement à chaque chargement). */
export function pickRandomQuote(category: QuoteCategory | 'all'): Quote {
  const pool = quotesForCategory(category)
  return pool[Math.floor(Math.random() * pool.length)]
}
