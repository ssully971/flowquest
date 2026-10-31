import { useEffect, useState } from 'react'

import { supabase } from '@/shared/supabase/client'

/** Niveau de pilier le plus haut de soi et de ses amis (RPC friends_pillar_levels, migration
 * 0057), par id d'utilisateur. Vide hors connexion ou en cas d'erreur : le badge est alors
 * simplement absent. Un seul appel partagé par tous les composants montés au même moment. */
let inflight: Promise<Map<string, number>> | null = null

function fetchLevels(): Promise<Map<string, number>> {
  if (inflight) return inflight
  inflight = (async () => {
    const levels = new Map<string, number>()
    try {
      if (!supabase) return levels
      const { data, error } = await supabase.rpc('friends_pillar_levels')
      if (error || !Array.isArray(data)) return levels
      for (const row of data) levels.set(row.user_id, row.top_level)
    } catch {
      // Réseau ou mock incomplet : pas de badge, jamais d'erreur affichée pour un bonus.
    }
    return levels
  })().finally(() => {
    inflight = null
  })
  return inflight
}

export function useFriendPillarLevels(enabled = true): ReadonlyMap<string, number> {
  const [levels, setLevels] = useState<ReadonlyMap<string, number>>(new Map())

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    void fetchLevels().then((result) => {
      if (!cancelled) setLevels(result)
    })
    return () => {
      cancelled = true
    }
  }, [enabled])

  return levels
}
