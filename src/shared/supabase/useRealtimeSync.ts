import { useCallback, useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

import { supabase } from './client'

/** Tant que le canal n'est pas SUBSCRIBED (connexion en cours, perdue, bloquée par un
 * réseau d'entreprise...), on interroge à cette cadence : un évènement manqué doit se
 * rattraper en quelques secondes, jamais en une demi-minute. */
export const POLL_FALLBACK_MS = 4_000

interface RealtimeSyncOptions {
  /** Interrogation de sécurité même quand le canal est SUBSCRIBED (ms) : filet contre un
   * canal « zombie » (Safari qui laisse le WebSocket mourir sans prévenir). Désactivé par
   * défaut ; les salons de focus l'activent. */
  safetyPollMs?: number
}

/**
 * Brique Realtime générique (règles transversales du Mode Amis) : abonnement sur un canal
 * nommé, resynchronisation complète (rechargement de l'état + nouvelle connexion) à chaque
 * retour au premier plan (`visibilitychange`, `pageshow`, `focus`) et au retour du réseau
 * (`online`) — iPad Safari suspend les onglets en arrière-plan et le canal peut être mort
 * au retour — et repli par interrogation toutes les 4 s tant que le canal n'est pas dans
 * l'état SUBSCRIBED. `configure` attache les écouteurs `.on('postgres_changes', ...)` propres
 * à l'appelant sur le canal fraîchement créé, et reçoit `notify` (stable, toujours la
 * dernière version de `onChange`) à utiliser comme callback plutôt que de fermer sur
 * `onChange` directement.
 *
 * Extrait de `useFriendsRealtime` (LOT F2) pour être réutilisé tel quel par les salons de
 * focus (LOT F3, voir `useRoomRealtime`), comme annoncé dans docs/AMIS.md.
 */
export function useRealtimeSync(
  channelName: string,
  configure: (channel: RealtimeChannel, notify: () => void) => void,
  onChange: () => void,
  enabled: boolean,
  options: RealtimeSyncOptions = {},
): void {
  const { safetyPollMs = 0 } = options
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

    let disposed = false
    // Vrai après une coupure ou une resynchronisation : au SUBSCRIBED suivant, on recharge
    // l'état pour combler la fenêtre pendant laquelle des évènements ont pu être manqués.
    let needsCatchUp = false
    let channel: RealtimeChannel | null = null
    let pollInterval: number | null = null
    let safetyInterval: number | null = null

    const clearPoll = () => {
      if (pollInterval !== null) {
        window.clearInterval(pollInterval)
        pollInterval = null
      }
    }

    const startPollFallback = () => {
      if (disposed || pollInterval !== null) return
      pollInterval = window.setInterval(notify, POLL_FALLBACK_MS)
    }

    const connect = () => {
      if (disposed) return
      const previous = channel
      channel = null
      if (previous) client.removeChannel(previous)
      const next = client.channel(channelName)
      configureRef.current(next, notify)
      channel = next
      // Connexion en cours : on rattrape par interrogation jusqu'au SUBSCRIBED.
      startPollFallback()
      next.subscribe((subStatus) => {
        // Les rappels d'un ancien canal (fermé par connect() ou par le nettoyage) ne
        // doivent ni réarmer l'interrogation ni effacer celle du canal courant.
        if (disposed || channel !== next) return
        if (subStatus === 'SUBSCRIBED') {
          clearPoll()
          if (needsCatchUp) {
            needsCatchUp = false
            notify()
          }
        } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
          needsCatchUp = true
          startPollFallback()
        }
      })
    }

    const resync = () => {
      if (disposed) return
      needsCatchUp = true
      notify()
      connect()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resync()
    }

    connect()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', resync)
    window.addEventListener('pageshow', resync)
    window.addEventListener('focus', resync)
    if (safetyPollMs > 0) {
      safetyInterval = window.setInterval(() => {
        if (document.visibilityState === 'visible') notify()
      }, safetyPollMs)
    }

    return () => {
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', resync)
      window.removeEventListener('pageshow', resync)
      window.removeEventListener('focus', resync)
      clearPoll()
      if (safetyInterval !== null) window.clearInterval(safetyInterval)
      if (channel) client.removeChannel(channel)
      channel = null
    }
  }, [channelName, enabled, notify, safetyPollMs])
}
