import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from './client'

const POLL_FALLBACK_MS = 30_000

/**
 * Brique Realtime générique (règles transversales du Mode Amis) : abonnement sur un canal
 * nommé, reconnexion à chaque `visibilitychange` (iPad Safari suspend les onglets en
 * arrière-plan, le canal peut être mort au retour) et repli par interrogation toutes les
 * 30 s si le canal n'est pas dans l'état SUBSCRIBED. `configure` attache les écouteurs
 * `.on('postgres_changes', ...)` propres à l'appelant sur le canal fraîchement créé, et
 * reçoit `notify` (stable, toujours la dernière version de `onChange`) à utiliser comme
 * callback plutôt que de fermer sur `onChange` directement.
 *
 * Extrait de `useFriendsRealtime` (LOT F2) pour être réutilisé tel quel par les salons de
 * focus (LOT F3, voir `useRoomRealtime`), comme annoncé dans docs/AMIS.md.
 */
export function useRealtimeSync(
  channelName: string,
  configure: (channel: RealtimeChannel, notify: () => void) => void,
  onChange: () => void,
  enabled: boolean,
): void {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  const notify = useCallback(() => onChangeRef.current(), [])

  const configureRef = useRef(configure)
  useEffect(() => {
    configureRef.current = configure
  }, [configure])

  useEffect(() => {
    if (!enabled || !supabase) return
    const client = supabase

    let channel: RealtimeChannel | null = null
    let pollInterval: number | null = null

    const clearPoll = () => {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval)
        pollInterval = null
      }
    }

    const startPollFallback = () => {
      clearPoll()
      pollInterval = window.setInterval(notify, POLL_FALLBACK_MS)
    }

    const connect = () => {
      if (channel) client.removeChannel(channel)
      const next = client.channel(channelName)
      configureRef.current(next, notify)
      channel = next.subscribe((subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          clearPoll()
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          startPollFallback()
        }
      })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        notify()
        connect()
      }
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearPoll()
      if (channel) client.removeChannel(channel)
    }
  }, [channelName, enabled, notify])
}
