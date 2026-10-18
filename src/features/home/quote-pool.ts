import { supabase } from '@/shared/supabase/client'

import { QUOTES } from './quotes'
import type { Quote, QuoteCategory } from './quotes'

function isQuoteCategory(value: string | null): value is QuoteCategory {
  return value === 'medicine' || value === 'focus'
}

/**
 * Citations actives gérées par le panneau Admin (§12). En repli — Supabase non configuré,
 * base vide, ou erreur réseau — le tableau statique QUOTES reste utilisé : jamais de
 * dépendance dure à la base pour un contenu aussi central que la citation d'accueil
 * (invité hors ligne compris).
 */
export async function fetchQuotePool(): Promise<Quote[]> {
  if (!supabase) return QUOTES
  const { data, error } = await supabase
    .from('quotes')
    .select('text, author, category')
    .eq('active', true)
  if (error || !data || data.length === 0) return QUOTES
  return data.map((row) => ({
    text: row.text,
    author: row.author ?? '',
    category: isQuoteCategory(row.category) ? row.category : 'focus',
  }))
}
