import { supabase } from '@/shared/supabase/client'
import type { Database } from '@/shared/supabase/database.types'

export type AdminQuoteRow = Database['public']['Tables']['quotes']['Row']

export interface NewQuoteInput {
  text: string
  author: string | null
  category: 'medicine' | 'focus'
}

/** Toutes les citations, actives ou non (politique quotes_select_admin) : réservé au panneau Admin. */
export async function listAllQuotes(): Promise<AdminQuoteRow[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })
  return error || !data ? [] : data
}

export async function createQuote(input: NewQuoteInput): Promise<AdminQuoteRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('quotes').insert(input).select().single()
  return error || !data ? null : data
}

export async function setQuoteActive(id: string, active: boolean): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('quotes').update({ active }).eq('id', id)
  return !error
}

export async function deleteQuote(id: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('quotes').delete().eq('id', id)
  return !error
}
