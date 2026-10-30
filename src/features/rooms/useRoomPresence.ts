import { useEffect } from 'react'

import { isSupabaseConfigured } from '@/shared/supabase/client'

import { touchMyRooms } from './rooms-repository'

/** Simple filet d'abandon (3 h de silence, côté serveur) : la présence « en ligne » affichée
 * vient de Supabase Presence (useRoomRealtime), pas de ce battement. */
const HEARTBEAT_MS = 120_000
const MIN_BEAT_GAP_MS = 60_000

/**
 * Battement de cœur des salons (LOT M1), monté UNE fois, globalement (AppShell) : tant que
 * je suis dans un salon non terminé, ma présence est signalée au serveur toutes les 2 min
 * (onglet visible) et dès le retour au premier plan, quel que soit l'écran affiché — fermer
 * l'écran du salon, changer de page ou suspendre l'onglet ne fait donc jamais quitter le
 * salon. Seuls les boutons explicites « Quitter » / « Terminer » le font (le serveur
 * n'abandonne qu'après 3 h de silence complet, voir migrations 0048 et 0050 : le battement
 * s'écrit dans room_heartbeats, table hors Realtime, et au plus une fois par minute).
 */
export function useRoomPresence(hasActiveRoom: boolean): void {
  useEffect(() => {
    if (!hasActiveRoom || !isSupabaseConfigured) return

    // Pas plus d'un battement par minute, même si plusieurs évènements de retour au premier
    // plan se suivent (visibilitychange + pageshow + online) : le serveur ne l'écrirait pas non plus.
    let lastBeatAt = Number.NEGATIVE_INFINITY
    const beat = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastBeatAt < MIN_BEAT_GAP_MS) return
      lastBeatAt = now
      void touchMyRooms().catch(() => {
        // Best-effort : hors ligne, le prochain battement rattrape.
      })
    }

    beat()
    const interval = window.setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    window.addEventListener('online', beat)
    window.addEventListener('pageshow', beat)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', beat)
      window.removeEventListener('online', beat)
      window.removeEventListener('pageshow', beat)
    }
  }, [hasActiveRoom])
}
