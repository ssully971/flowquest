import { useEffect } from 'react'

import { isSupabaseConfigured } from '@/shared/supabase/client'

import { touchMyRooms } from './rooms-repository'

const HEARTBEAT_MS = 30_000

/**
 * Battement de cœur des salons (LOT M1), monté UNE fois, globalement (AppShell) : tant que
 * je suis dans un salon non terminé, ma présence est signalée au serveur toutes les 30 s
 * (onglet visible) et dès le retour au premier plan, quel que soit l'écran affiché — fermer
 * l'écran du salon, changer de page ou suspendre l'onglet ne fait donc jamais quitter le
 * salon. Seuls les boutons explicites « Quitter » / « Terminer » le font (le serveur
 * n'abandonne qu'après 3 h de silence complet, voir migration 0048).
 */
export function useRoomPresence(hasActiveRoom: boolean): void {
  useEffect(() => {
    if (!hasActiveRoom || !isSupabaseConfigured) return

    const beat = () => {
      if (document.visibilityState !== 'visible') return
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
