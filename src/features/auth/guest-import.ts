import { DEFAULT_SETTINGS } from '@/features/settings/types'
import type { AppSettings } from '@/features/settings/types'
import { IndexedDbSettingsRepository } from '@/features/settings/storage/indexed-db-settings-repository'
import { SupabaseSettingsRepository } from '@/features/settings/storage/supabase-settings-repository'
import { IndexedDbTimerStateRepository } from '@/features/timer/storage/indexed-db-timer-state-repository'
import { SupabaseTimerStateRepository } from '@/features/timer/storage/supabase-timer-state-repository'
import { getDb } from '@/shared/storage/db'
import { enqueueWrite } from '@/shared/sync/offline-queue'

const localSettingsRepo = new IndexedDbSettingsRepository()
const remoteSettingsRepo = new SupabaseSettingsRepository()
const localTimerRepo = new IndexedDbTimerStateRepository()
const remoteTimerRepo = new SupabaseTimerStateRepository()

function settingsDifferFromDefaults(settings: AppSettings): boolean {
  return JSON.stringify(settings) !== JSON.stringify(DEFAULT_SETTINGS)
}

/**
 * Vrai s'il existe des données locales (invité) qui valent la peine d'être proposées à
 * l'import : des réglages changés par rapport aux valeurs par défaut, un minuteur déjà
 * utilisé au moins une fois, ou des sessions de focus enregistrées localement.
 */
export async function hasLocalGuestData(): Promise<boolean> {
  const [settings, timerState, sessionCount] = await Promise.all([
    localSettingsRepo.load(),
    localTimerRepo.loadWithMeta(),
    getDb().then((db) => db.count('focusSessions')),
  ])

  if (settings && settingsDifferFromDefaults(settings.settings)) return true
  if (timerState && timerState.state.startedAt !== null) return true
  if (sessionCount > 0) return true
  return false
}

export interface ImportSummary {
  importedSettings: boolean
  importedTimerState: boolean
  importedSessions: number
}

/**
 * Pousse les données locales (invité) vers le compte nouvellement créé. Sans risque de
 * doublon : réglages et minuteur sont des lignes uniques par utilisateur (upsert), et
 * chaque session locale garde l'id qu'elle avait déjà (upsert aussi, jamais une
 * nouvelle insertion dupliquée si l'import est relancé après un échec partiel).
 */
export async function importGuestDataToAccount(userId: string): Promise<ImportSummary> {
  const summary: ImportSummary = {
    importedSettings: false,
    importedTimerState: false,
    importedSessions: 0,
  }

  const settings = await localSettingsRepo.load()
  if (settings && settingsDifferFromDefaults(settings.settings)) {
    await remoteSettingsRepo.save(userId, settings.settings, Date.now())
    summary.importedSettings = true
  }

  const timerState = await localTimerRepo.loadWithMeta()
  if (timerState && timerState.state.startedAt !== null) {
    await remoteTimerRepo.save(userId, timerState.state, Date.now())
    summary.importedTimerState = true
  }

  const db = await getDb()
  const sessions = await db.getAll('focusSessions')
  for (const session of sessions) {
    await enqueueWrite('focus_sessions', {
      id: session.id,
      user_id: userId,
      kind: session.kind,
      planned_seconds: session.plannedSeconds,
      actual_seconds: session.actualSeconds,
      started_at: new Date(session.startedAt).toISOString(),
      ended_at: session.endedAt ? new Date(session.endedAt).toISOString() : null,
      completed: session.completed,
    })
    summary.importedSessions += 1
  }

  return summary
}

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const OFFERED_KEY_PREFIX = 'flowquest.importOffered.'

export function hasOfferedImport(userId: string): boolean {
  try {
    return window.localStorage.getItem(OFFERED_KEY_PREFIX + userId) === 'true'
  } catch {
    return true // Stockage indisponible : on évite de redemander en boucle.
  }
}

export function markImportOffered(userId: string): void {
  try {
    window.localStorage.setItem(OFFERED_KEY_PREFIX + userId, 'true')
  } catch {
    // Stockage indisponible (navigation privée) : rien de grave, on redemandera.
  }
}
