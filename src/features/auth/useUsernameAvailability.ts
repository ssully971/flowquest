import { useEffect, useRef, useState } from 'react'

import { supabase } from '@/shared/supabase/client'

export type UsernameAvailability = 'idle' | 'checking' | 'available' | 'taken' | 'error'

const DEBOUNCE_MS = 400

/** Vérifie en direct, pendant la saisie, si un pseudo au format valide est déjà pris par
 * un autre compte (RPC is_username_available, migration 0012 — la politique RLS de
 * profiles empêche un select direct de le savoir). `enabled` doit être faux tant que le
 * format n'est pas valide, pour ne pas interroger la base pour rien. */
interface Resolved {
  username: string
  result: UsernameAvailability
}

export function useUsernameAvailability(username: string, enabled: boolean): UsernameAvailability {
  // Ne mémorise que le dernier résultat réellement résolu (par le callback asynchrone de
  // la requête, jamais de setState synchrone dans le corps de l'effet). L'état "checking"
  // est dérivé : tant qu'aucun résultat résolu ne correspond au pseudo courant, on
  // considère qu'une vérification est en cours (délai de debounce inclus).
  const [resolved, setResolved] = useState<Resolved | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (!enabled || !supabase) return

    const client = supabase
    const requestId = ++requestIdRef.current
    const timeoutId = window.setTimeout(() => {
      void client
        .rpc('is_username_available', { p_username: username })
        .then(({ data, error }) => {
          // Une saisie plus récente a déjà relancé une requête : cette réponse est
          // obsolète, on l'ignore pour ne pas afficher un résultat périmé.
          if (requestIdRef.current !== requestId) return
          setResolved({ username, result: error ? 'error' : data ? 'available' : 'taken' })
        })
    }, DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [username, enabled])

  if (!enabled) return 'idle'
  if (resolved && resolved.username === username) return resolved.result
  return 'checking'
}
