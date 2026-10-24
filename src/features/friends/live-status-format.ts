import type { LiveState } from '@/shared/supabase/database.types'

/** Minutes écoulées depuis le début de l'état courant — pure, testable sans horloge réelle
 * grâce au paramètre `now`. */
export function formatElapsedMinutes(startedAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60_000))
}

/** Vert en focus, ambre en pause, gris neutre sinon (ligne mais inactif) — jamais affiché
 * du tout si hors ligne (voir Avatar : statusDotColor absent = pas de point). */
export function liveStateColor(state: LiveState): string {
  if (state === 'focus') return '#22C55E'
  if (state === 'pause') return '#F59E0B'
  return '#9CA3AF'
}
