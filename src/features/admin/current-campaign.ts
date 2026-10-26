import { supabase } from '@/shared/supabase/client'
import type { CurrentGameCampaignRow } from '@/shared/supabase/database.types'

/** Lue par n'importe quel compte (RPC current_game_campaign(), §6) — jamais de lecture
 * directe de game_campaigns, qui n'a aucune politique RLS select pour authenticated/anon
 * (seul l'historique complet, réservé aux admins, passerait par admin_list_campaigns()). */
export async function fetchCurrentCampaign(): Promise<CurrentGameCampaignRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('current_game_campaign')
  return error || !data || data.length === 0 ? null : data[0]
}
