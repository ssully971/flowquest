// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const STORAGE_KEY = 'flowquest.lastSeenChangelogVersion'

/** Dernière version du journal vue par la personne (§7.9 : badge « nouveau »). */
export function getLastSeenChangelogVersion(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function markChangelogSeen(version: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, version)
  } catch {
    // Stockage indisponible (navigation privée) : le badge réapparaîtra au prochain chargement.
  }
}
