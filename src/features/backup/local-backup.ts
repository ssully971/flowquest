import { IndexedDbNoteRepository } from '@/features/notes/storage/indexed-db-note-repository'
import type { StoredNote } from '@/features/notes/storage/indexed-db-note-repository'
import { IndexedDbSettingsRepository } from '@/features/settings/storage/indexed-db-settings-repository'
import type { StoredSettings } from '@/features/settings/storage/settings-repository'
import { IndexedDbTaskRepository } from '@/features/tasks/storage/indexed-db-task-repository'
import { IndexedDbFocusSessionRepository } from '@/features/timer/storage/focus-session-repository'
import { APP_NAME } from '@/shared/app-config'
import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

export const BACKUP_SCHEMA_VERSION = 1
// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const BACKUP_APP_MARKER = 'flowquest'
// À l'import, une sauvegarde portant l'ancien OU le nouveau marqueur est acceptée ; à l'export,
// on garde l'ancien (phase 1 du renommage) pour que les sauvegardes restent lisibles par les
// versions déjà installées.
const ACCEPTED_BACKUP_MARKERS: readonly unknown[] = [BACKUP_APP_MARKER, 'fokitsu']

export interface LocalBackup {
  app: typeof BACKUP_APP_MARKER
  schemaVersion: number
  exportedAt: string
  tasks: TaskRecord[]
  notes: StoredNote | null
  focusSessions: FocusSessionRecord[]
  settings: StoredSettings | null
}

export interface ImportSummary {
  tasksAdded: number
  tasksSkipped: number
  focusSessionsAdded: number
  focusSessionsSkipped: number
  notesUpdated: boolean
  settingsUpdated: boolean
}

export class BackupParseError extends Error {}

const taskRepository = new IndexedDbTaskRepository()
const noteRepository = new IndexedDbNoteRepository()
const focusSessionRepository = new IndexedDbFocusSessionRepository()
const settingsRepository = new IndexedDbSettingsRepository()

export async function createBackup(): Promise<LocalBackup> {
  const [tasks, notes, focusSessions, settings] = await Promise.all([
    taskRepository.listAll(),
    noteRepository.load(),
    focusSessionRepository.listAll(),
    settingsRepository.load(),
  ])

  return {
    app: BACKUP_APP_MARKER,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks,
    notes,
    focusSessions,
    settings,
  }
}

export function downloadBackup(backup: LocalBackup): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const dateStamp = backup.exportedAt.slice(0, 10)

  const link = document.createElement('a')
  link.href = url
  link.download = `fokitsu-sauvegarde-${dateStamp}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportLocalBackup(): Promise<void> {
  const backup = await createBackup()
  downloadBackup(backup)
}

function isTaskRecord(value: unknown): value is TaskRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.title === 'string'
}

function isFocusSessionRecord(value: unknown): value is FocusSessionRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.startedAt === 'number'
}

export function parseBackupFile(raw: string): LocalBackup {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BackupParseError('Ce fichier n’est pas un JSON valide.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new BackupParseError(`Ce fichier ne contient pas une sauvegarde ${APP_NAME} valide.`)
  }
  const candidate = parsed as Record<string, unknown>

  if (!ACCEPTED_BACKUP_MARKERS.includes(candidate.app)) {
    throw new BackupParseError(`Ce fichier ne vient pas de ${APP_NAME}.`)
  }
  if (typeof candidate.schemaVersion !== 'number') {
    throw new BackupParseError('Ce fichier de sauvegarde est corrompu (version manquante).')
  }
  if (candidate.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new BackupParseError(
      `Cette sauvegarde vient d’une version plus récente de ${APP_NAME}. Mets l’application à jour avant de l’importer.`,
    )
  }
  if (!Array.isArray(candidate.tasks) || !candidate.tasks.every(isTaskRecord)) {
    throw new BackupParseError('Ce fichier de sauvegarde est corrompu (tâches invalides).')
  }
  if (
    !Array.isArray(candidate.focusSessions) ||
    !candidate.focusSessions.every(isFocusSessionRecord)
  ) {
    throw new BackupParseError('Ce fichier de sauvegarde est corrompu (sessions invalides).')
  }

  return {
    app: BACKUP_APP_MARKER,
    schemaVersion: candidate.schemaVersion,
    exportedAt:
      typeof candidate.exportedAt === 'string' ? candidate.exportedAt : new Date().toISOString(),
    tasks: candidate.tasks,
    notes: (candidate.notes as StoredNote | null) ?? null,
    focusSessions: candidate.focusSessions,
    settings: (candidate.settings as StoredSettings | null) ?? null,
  }
}

/**
 * Import déduplicé : ne recrée jamais une tâche ou une session déjà présente localement
 * (même id). Pour les tâches, la version la plus récente (updatedAt) l'emporte, au cas où
 * la même tâche aurait été modifiée des deux côtés depuis l'export. Notes et réglages sont
 * chacun un seul blob : importés seulement s'ils sont plus récents que la version locale.
 */
export async function importBackup(backup: LocalBackup): Promise<ImportSummary> {
  const existingTasks = await taskRepository.listAll()
  const existingTaskById = new Map(existingTasks.map((task) => [task.id, task]))

  const tasksToPut: TaskRecord[] = []
  let tasksAdded = 0
  let tasksSkipped = 0
  for (const task of backup.tasks) {
    const existing = existingTaskById.get(task.id)
    if (!existing) {
      tasksToPut.push(task)
      tasksAdded += 1
    } else if (task.updatedAt > existing.updatedAt) {
      tasksToPut.push(task)
      tasksAdded += 1
    } else {
      tasksSkipped += 1
    }
  }
  if (tasksToPut.length > 0) await taskRepository.putMany(tasksToPut)

  const existingFocusSessions = await focusSessionRepository.listAll()
  const existingFocusSessionIds = new Set(existingFocusSessions.map((session) => session.id))
  let focusSessionsAdded = 0
  let focusSessionsSkipped = 0
  for (const session of backup.focusSessions) {
    if (existingFocusSessionIds.has(session.id)) {
      focusSessionsSkipped += 1
      continue
    }
    await focusSessionRepository.add(session)
    focusSessionsAdded += 1
  }

  let notesUpdated = false
  if (backup.notes) {
    const existingNote = await noteRepository.load()
    if (!existingNote || backup.notes.updatedAt > existingNote.updatedAt) {
      await noteRepository.save(backup.notes.content, backup.notes.updatedAt)
      notesUpdated = true
    }
  }

  let settingsUpdated = false
  if (backup.settings) {
    const existingSettings = await settingsRepository.load()
    if (!existingSettings || backup.settings.updatedAt > existingSettings.updatedAt) {
      await settingsRepository.save(backup.settings.settings, backup.settings.updatedAt)
      settingsUpdated = true
    }
  }

  return {
    tasksAdded,
    tasksSkipped,
    focusSessionsAdded,
    focusSessionsSkipped,
    notesUpdated,
    settingsUpdated,
  }
}
