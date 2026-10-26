import { useEffect, useId, useState } from 'react'

import { isSupabaseConfigured, supabase } from '@/shared/supabase/client'
import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

interface MaintenanceState {
  enabled: boolean
  message: string
}

const DEFAULT_STATE: MaintenanceState = { enabled: false, message: '' }

/**
 * Cas particulier du drapeau « maintenance » (lot I2, §1) : seul drapeau dont le texte
 * (`description`) est affiché tel quel aux utilisateurs — un vrai message modifiable
 * depuis l'admin, pas juste un libellé interne. Séparé de useFeatureFlag() (qui ne
 * renvoie qu'un booléen) plutôt que de complexifier son cache partagé pour ce seul cas.
 */
export function useMaintenanceBanner(): MaintenanceState {
  const [state, setState] = useState<MaintenanceState>(DEFAULT_STATE)

  const fetchState = () => {
    if (!isSupabaseConfigured || !supabase) return Promise.resolve()
    return Promise.resolve(
      supabase
        .from('feature_flags')
        .select('enabled, description')
        .eq('key', 'maintenance')
        .single(),
    )
      .then(({ data, error }) => {
        if (error || !data) return
        setState({ enabled: data.enabled, message: data.description })
      })
      .catch(() => {
        // Hors ligne ou service indisponible : aucun bandeau plutôt qu'un message périmé.
      })
  }

  useEffect(() => {
    void fetchState()
  }, [])

  const instanceId = useId()
  useRealtimeSync(
    `maintenance-banner-${instanceId}`,
    (channel, notify) => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'feature_flags', filter: 'key=eq.maintenance' },
        notify,
      )
    },
    () => void fetchState(),
    isSupabaseConfigured,
  )

  return state
}
