import { useEffect, useState } from 'react'

import { fetchCurrentCampaign } from '@/features/admin/current-campaign'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import type { CurrentGameCampaignRow } from '@/shared/supabase/database.types'

const POLL_INTERVAL_MS = 60_000

/** game_campaigns n'est pas dans la publication realtime (table admin, jamais lue
 * directement côté client — voir 0045_game_campaigns.sql) : un simple sondage toutes les
 * 60 s suffit, la fenêtre d'une campagne se compte en heures/jours, pas en secondes. */
export function useCurrentCampaign(): CurrentGameCampaignRow | null {
  const [campaign, setCampaign] = useState<CurrentGameCampaignRow | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    const refresh = () => {
      void fetchCurrentCampaign().then((result) => {
        if (!cancelled) setCampaign(result)
      })
    }
    refresh()
    const interval = window.setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  return campaign
}
