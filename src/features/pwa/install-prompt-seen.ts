// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.installPromptSeen'

/** §6.2 du cahier des charges : la popup d'installation ne doit s'afficher qu'une
 * seule fois (par appareil). */
export function hasSeenInstallPrompt(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return true
  }
}

export function markInstallPromptSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'true')
  } catch {
    // Stockage indisponible (navigation privée) : la popup pourra réapparaître.
  }
}
