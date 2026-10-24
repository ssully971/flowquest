import { useId } from 'react'

import { useRealtimeSync } from '@/shared/supabase/useRealtimeSync'

/**
 * Supabase Realtime pour le statut en direct des amis (Mode Amis, LOT F2, règles
 * transversales) : rafraîchit `onChange` à chaque évènement sur live_status (filtré par
 * RLS — on ne reçoit que ce qu'on a déjà le droit de lire).
 *
 * Suffixe `useId()` sur le nom du canal (trouvé en LOT F3, via le test Playwright à deux
 * contextes des salons) : `useFriends()` est maintenant monté à la fois par
 * `FriendsPanel` et par `RoomsPanel` (dont les hooks tournent même fermés, `open` ne
 * fait que masquer le rendu) — deux canaux Realtime au même nom fixe fait planter le
 * client realtime-js de supabase-js (« cannot add postgres_changes callbacks ... after
 * subscribe() »). Un nom par instance de hook règle la collision, au prix d'un canal par
 * panneau plutôt qu'un canal partagé — acceptable pour un évènement aussi rare qu'un
 * changement de statut en direct.
 */
export function useFriendsRealtime(onChange: () => void, enabled: boolean): void {
  const instanceId = useId()
  useRealtimeSync(
    `live-status-friends-${instanceId}`,
    (channel, notify) => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'live_status' }, notify)
    },
    onChange,
    enabled,
  )
}
