import { deleteDB } from 'idb'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const INDEXED_DB_NAME = 'flowquest'

/**
 * Vide complètement le stockage de cet appareil (LOT E9) : dernier recours pour une
 * personne bloquée après avoir supprimé son compte côté Supabase sans s'être déconnectée
 * — localStorage garde alors une session qui ne correspond plus à rien, et l'app ne peut
 * plus avancer. Efface localStorage, sessionStorage, la base IndexedDB (réglages, tâches,
 * notes, sessions de focus, état du minuteur), le cache du Service Worker et désenregistre
 * le Service Worker lui-même, pour repartir d'un appareil complètement vierge.
 */
export async function clearAllLocalStorage(): Promise<void> {
  try {
    window.localStorage.clear()
  } catch {
    // Stockage indisponible (navigation privée) : rien à vider.
  }
  try {
    window.sessionStorage.clear()
  } catch {
    // Idem.
  }

  try {
    await deleteDB(INDEXED_DB_NAME)
  } catch {
    // Base déjà absente ou verrouillée par un onglet encore ouvert : on continue quand
    // même les autres nettoyages plutôt que de tout bloquer.
  }

  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    } catch {
      // Sans conséquence si l'API est indisponible sur ce navigateur.
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    } catch {
      // Idem.
    }
  }
}
