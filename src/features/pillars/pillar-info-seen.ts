const KEY = 'flowquest.pillarInfoSeen'

/** L'explication des piliers s'ouvre d'elle-même une seule fois (création du premier pilier). */
export function hasSeenPillarInfo(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markPillarInfoSeen(): void {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    // Stockage indisponible : l'explication pourra se rouvrir, sans conséquence.
  }
}
