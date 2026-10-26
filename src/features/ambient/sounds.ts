export interface AmbientSound {
  id: string
  label: string
  src: string
}

/** §12/§17/§18 du cahier des charges : catalogue des sons d'ambiance, servis en boucles
 * compressées avec le site (pas de table Supabase pour l'instant). Bouclés sans coupure
 * via Web Audio API (voir useAmbientSounds, LOT C3). */
export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'rain', label: 'Pluie', src: '/sounds/rain.mp3' },
  { id: 'waves', label: 'Vagues', src: '/sounds/waves.mp3' },
  { id: 'forest', label: 'Forêt', src: '/sounds/forest.mp3' },
  { id: 'fire', label: 'Feu de camp', src: '/sounds/fire.mp3' },
]

export const MAX_SIMULTANEOUS_SOUNDS = 2

export const SLEEP_TIMER_OPTIONS_MINUTES = [15, 30, 45, 60] as const

/**
 * Recouvrement du fondu enchaîné (lot 4, §1 — voir crossfade-loop.ts) : 1 s pour les
 * quatre fichiers du catalogue, retenu après mesure de leur durée réelle (`ffprobe`) —
 * fire.mp3 ≈ 29,5 s, forest.mp3 ≈ 30,0 s, rain.mp3 ≈ 30,2 s, waves.mp3 ≈ 10,8 s (le plus
 * court du lot). Une seule valeur plutôt qu'un réglage par fichier : 1 s reste largement
 * inférieur à la moitié de la durée du plus court des quatre (waves.mp3), donc le
 * recouvrement n'empiète jamais sur le plateau à plein volume d'aucun des quatre sons ;
 * createCrossfadeLoop plafonne de toute façon ce recouvrement à `duration / 2` pour un
 * éventuel futur fichier plus court que 2 s.
 */
export const CROSSFADE_OVERLAP_SECONDS = 1
