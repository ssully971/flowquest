import type { SettingsPageId } from './page-id'
import { SETTINGS_PAGE_IDS } from './page-id'

const STORAGE_KEY = 'flowquest.settingsLastPage'

/** Dernière page des Réglages ouverte par la personne (lot 2 : le panneau se souvient
 * de la dernière page visitée, pas seulement de la page par défaut configurée dans
 * Extras — cette dernière ne sert plus que de repli au tout premier usage). */
export function getLastSettingsPage(): SettingsPageId | null {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored && (SETTINGS_PAGE_IDS as string[]).includes(stored)
      ? (stored as SettingsPageId)
      : null
  } catch {
    return null
  }
}

export function setLastSettingsPage(page: SettingsPageId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, page)
  } catch {
    // Stockage indisponible (navigation privée) : la préférence ne survit pas au rechargement.
  }
}
