import { useEffect, useRef } from 'react'

import { supabase } from '@/shared/supabase/client'

const POLL_FALLBACK_MS = 30_000

/**
 * Supabase Realtime pour le statut en direct des amis (Mode Amis, LOT F2, règles
 * transversales) : rafraîchit `onChange` à chaque évènement sur live_status (filtré par
 * RLS — on ne reçoit que ce qu'on a déjà le droit de lire). Reconnecte à chaque
 * visibilitychange (iPad Safari suspend les onglets en arrière-plan, le canal peut être
 * mort au retour) et retombe sur une interrogation toutes les 30 s si le canal n'est pas
 * dans l'état SUBSCRIBED.
 */
export function useFriendsRealtime(onChange: () => void, enabled: boolean): void {
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!enabled || !supabase) return
    const client = supabase

    let channel: ReturnType<typeof client.channel> | null = null
    let pollInterval: number | null = null

    const clearPoll = () => {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval)
        pollInterval = null
      }
    }

    const startPollFallback = () => {
      clearPoll()
      pollInterval = window.setInterval(() => onChangeRef.current(), POLL_FALLBACK_MS)
    }

    const connect = () => {
      if (channel) client.removeChannel(channel)
      channel = client
        .channel('live-status-friends')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_status' }, () => {
          onChangeRef.current()
        })
        .subscribe((subStatus) => {
          if (subStatus === 'SUBSCRIBED') {
            clearPoll()
          } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
            startPollFallback()
          }
        })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        onChangeRef.current()
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
  }, [enabled])
}
