export interface AmbientSound {
  id: string
  label: string
  src: string
}

/** §12/§17/§18 du cahier des charges : catalogue des sons d'ambiance, servis en boucles
 * compressées avec le site (pas de table Supabase pour l'instant). Les fichiers de
 * public/sounds sont pour le moment des boucles silencieuses de remplacement, en
 * attendant des sons définitifs libres de droits. */
export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', label: 'Pluie', src: '/sounds/rain.mp3' },
  { id: 'waves', label: 'Vagues', src: '/sounds/waves.mp3' },
  { id: 'forest', label: 'Forêt', src: '/sounds/forest.mp3' },
  { id: 'fire', label: 'Feu de camp', src: '/sounds/fire.mp3' },
]

export const MAX_SIMULTANEOUS_SOUNDS = 2

export const SLEEP_TIMER_OPTIONS_MINUTES = [15, 30, 45, 60] as const
