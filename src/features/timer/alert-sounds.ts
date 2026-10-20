export interface AlertSound {
  id: string
  label: string
  src: string
}

/** Catalogue des sons d'alerte de fin de session (lot 4). */
export const ALERT_SOUNDS: AlertSound[] = [
  { id: 'carillon', label: 'Carillon', src: '/sounds/alerts/carillon.mp3' },
  { id: 'cloche', label: 'Cloche', src: '/sounds/alerts/cloche.mp3' },
  { id: 'marimba', label: 'Marimba', src: '/sounds/alerts/marimba.mp3' },
  { id: 'doux', label: 'Doux', src: '/sounds/alerts/doux.mp3' },
  { id: 'classique', label: 'Classique', src: '/sounds/alerts/classique.mp3' },
]

export function getAlertSound(id: string): AlertSound {
  return ALERT_SOUNDS.find((sound) => sound.id === id) ?? ALERT_SOUNDS[0]
}

export function playAlertSound(soundId: string, volume: number): void {
  try {
    const sound = getAlertSound(soundId)
    const audio = new Audio(sound.src)
    audio.volume = Math.min(1, Math.max(0, volume))
    void audio.play().catch(() => {
      // Lecture automatique bloquée (pas de geste utilisateur récent) : pas d'alerte sonore,
      // la notification/le titre d'onglet restent les autres alertes possibles.
    })
  } catch {
    // Lecture audio indisponible sur ce navigateur.
  }
}
