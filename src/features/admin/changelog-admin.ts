import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type AdminChangelogRow = Database['public']['Tables']['changelog']['Row']

export interface NewChangelogInput {
  version: string
  released_at: string
  body: string
}

/** Toutes les entrées, publiées ou non (politique changelog_select_admin) : réservé au panneau Admin. */
export async function listAllChangelogEntries(): Promise<AdminChangelogRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('changelog')
    .select('*')
    .order('released_at', { ascending: false })
  return error || !data ? [] : data
}

export async function createChangelogEntry(
  input: NewChangelogInput,
): Promise<AdminChangelogRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('changelog').insert(input).select().single()
  return error || !data ? null : data
}

export async function setChangelogEntryActive(id: string, active: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('changelog').update({ active }).eq('id', id)
  return !error
}

export async function deleteChangelogEntry(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('changelog').delete().eq('id', id)
  return !error
}
