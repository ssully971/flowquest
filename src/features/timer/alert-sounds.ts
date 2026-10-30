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

// ─── Alerte « Tu es toujours là ? » (garde anti-oubli de 4 h) ───────────────

/** Son dédié à la garde de 4 h : volontairement HORS du catalogue ci-dessus (ce n'est pas un son de
 * fin de session qu'on peut choisir), mais il respecte le même volume et le même réglage de son. */
export const GUARD_ALERT_SRC = '/sounds/alerts/alerte-4h.mp3'

let guardAudio: HTMLAudioElement | null = null

function getGuardAudio(): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null
  guardAudio ??= new Audio(GUARD_ALERT_SRC)
  return guardAudio
}

/**
 * Déblocage audio mobile : iOS / Android n'autorisent la lecture qu'après un geste de
 * l'utilisateur. Appelée sur un geste (lancer le minuteur, « Je suis là »), elle « amorce » le
 * lecteur dédié en le lançant muet puis en l'arrêtant : la lecture de l'alerte, des heures plus
 * tard et sans geste, est alors permise sur le même élément audio.
 */
export function primeGuardAlertAudio(): void {
  try {
    const audio = getGuardAudio()
    if (!audio) return
    audio.muted = true
    void audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
        audio.muted = false
      })
      .catch(() => {
        audio.muted = false
      })
  } catch {
    // Audio indisponible : l'alerte visuelle reste le repli.
  }
}

/** Joue l'alerte de la garde de 4 h. Renvoie `false` si le navigateur bloque la lecture (pas de
 * geste récent) : l'appelant affiche alors un repli visuel. */
export async function playGuardAlert(volume: number): Promise<boolean> {
  try {
    const audio = getGuardAudio()
    if (!audio) return false
    audio.muted = false
    audio.currentTime = 0
    audio.volume = Math.min(1, Math.max(0, volume))
    await audio.play()
    return true
  } catch {
    return false
  }
}
