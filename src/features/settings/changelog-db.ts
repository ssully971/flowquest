import { supabase } from '@/shared/supabase/client'

import { CHANGELOG } from './changelog'
import type { ChangelogEntry } from './changelog'

/**
 * Entrées de nouveautés publiées, gérées par le panneau Admin (§12). En repli — Supabase
 * non configuré, base vide, ou erreur réseau — le tableau statique CHANGELOG reste
 * utilisé : jamais de dépendance dure à la base (invité hors ligne compris).
 */
export async function fetchChangelogEntries(): Promise<ChangelogEntry[]> {
  if (!supabase) return CHANGELOG
  const { data, error } = await supabase
    .from('changelog')
    .select('version, released_at, body')
    .eq('active', true)
    .order('released_at', { ascending: false })
  if (error || !data || data.length === 0) return CHANGELOG
  return data.map((row) => ({ version: row.version, date: row.released_at, text: row.body }))
}
