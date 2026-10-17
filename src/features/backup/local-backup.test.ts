import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord, TaskRecord } from '@/shared/storage/db'

import {
  BACKUP_SCHEMA_VERSION,
  BackupParseError,
  createBackup,
  downloadBackup,
  importBackup,
  parseBackupFile,
} from './local-backup'
import type { LocalBackup } from './local-backup'

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-1',
    title: 'Réviser',
    position: 0,
    done: false,
    doneAt: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  }
}

function makeFocusSession(overrides: Partial<FocusSessionRecord> = {}): FocusSessionRecord {
  return {
    id: 'session-1',
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_001_500_000,
    completed: true,
    taskId: null,
    syncedAt: null,
    ...overrides,
  }
}

function makeEmptyBackup(overrides: Partial<LocalBackup> = {}): LocalBackup {
  return {
    app: 'flowquest',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(1_700_000_000_000).toISOString(),
    tasks: [],
    notes: null,
    focusSessions: [],
    settings: null,
    ...overrides,
  }
}

describe('local-backup — export', () => {
  beforeEach(async () => {
    const db = await getDb()
    await db.clear('tasks')
    await db.clear('focusSessions')
    await db.delete('notes', 'current')
    await db.delete('settings', 'current')
  })

  it('crée une sauvegarde vide quand rien n’a été stocké localement', async () => {
    const backup = await createBackup()
    expect(backup.app).toBe('flowquest')
    expect(backup.tasks).toEqual([])
    expect(backup.notes).toBeNull()
    expect(backup.focusSessions).toEqual([])
    expect(backup.settings).toBeNull()
  })

  it('inclut les tâches et sessions enregistrées localement', async () => {
    const db = await getDb()
    await db.put('tasks', makeTask())
    await db.put('focusSessions', makeFocusSession())

    const backup = await createBackup()
    expect(backup.tasks).toEqual([makeTask()])
    expect(backup.focusSessions).toEqual([makeFocusSession()])
  })

  it('déclenche un téléchargement du fichier JSON', () => {
    const createObjectURL = vi.fn(() => 'blob:fake-url')
    const revokeObjectURL = vi.fn()
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadBackup(makeEmptyBackup())

    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url')

    clickSpy.mockRestore()
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  })
})

describe('local-backup — parseBackupFile', () => {
  it('refuse un JSON invalide', () => {
    expect(() => parseBackupFile('{ pas du json')).toThrow(BackupParseError)
  })

  it('refuse un fichier qui ne vient pas de Flowquest', () => {
    expect(() => parseBackupFile(JSON.stringify({ app: 'autre-app' }))).toThrow(BackupParseError)
  })

  it('refuse une sauvegarde d’une version plus récente que celle supportée', () => {
    const raw = JSON.stringify(makeEmptyBackup({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }))
    expect(() => parseBackupFile(raw)).toThrow(BackupParseError)
  })

  it('accepte une sauvegarde valide', () => {
    const raw = JSON.stringify(makeEmptyBackup({ tasks: [makeTask()] }))
    const parsed = parseBackupFile(raw)
    expect(parsed.tasks).toEqual([makeTask()])
  })
})

describe('local-backup — importBackup (déduplication)', () => {
  beforeEach(async () => {
    const db = await getDb()
    await db.clear('tasks')
    await db.clear('focusSessions')
    await db.delete('notes', 'current')
    await db.delete('settings', 'current')
  })

  it('ajoute une tâche absente localement', async () => {
    const summary = await importBackup(makeEmptyBackup({ tasks: [makeTask()] }))
    expect(summary.tasksAdded).toBe(1)
    expect(summary.tasksSkipped).toBe(0)

    const db = await getDb()
    expect(await db.get('tasks', 'task-1')).toEqual(makeTask())
  })

  it('ignore une tâche déjà présente et pas plus récente (pas de doublon)', async () => {
    const db = await getDb()
    await db.put('tasks', makeTask({ updatedAt: 2_000_000_000_000 }))

    const summary = await importBackup(makeEmptyBackup({ tasks: [makeTask({ updatedAt: 1_000_000_000_000 })] }))
    expect(summary.tasksAdded).toBe(0)
    expect(summary.tasksSkipped).toBe(1)
    expect((await db.get('tasks', 'task-1'))?.updatedAt).toBe(2_000_000_000_000)
  })

  it('remplace une tâche existante si la version importée est plus récente', async () => {
    const db = await getDb()
    await db.put('tasks', makeTask({ title: 'Ancien titre', updatedAt: 1_000_000_000_000 }))

    const summary = await importBackup(
      makeEmptyBackup({ tasks: [makeTask({ title: 'Nouveau titre', updatedAt: 2_000_000_000_000 })] }),
    )
    expect(summary.tasksAdded).toBe(1)
    expect((await db.get('tasks', 'task-1'))?.title).toBe('Nouveau titre')
  })

  it('ignore une session déjà présente (id déjà existant)', async () => {
    const db = await getDb()
    await db.put('focusSessions', makeFocusSession())

    const summary = await importBackup(makeEmptyBackup({ focusSessions: [makeFocusSession()] }))
    expect(summary.focusSessionsAdded).toBe(0)
    expect(summary.focusSessionsSkipped).toBe(1)
  })

  it('ajoute une session absente localement', async () => {
    const summary = await importBackup(makeEmptyBackup({ focusSessions: [makeFocusSession()] }))
    expect(summary.focusSessionsAdded).toBe(1)
  })

  it('importe les notes seulement si elles sont plus récentes', async () => {
    const summaryFirst = await importBackup(
      makeEmptyBackup({ notes: { content: 'Bonjour', updatedAt: 1_000_000_000_000 } }),
    )
    expect(summaryFirst.notesUpdated).toBe(true)

    const summarySecond = await importBackup(
      makeEmptyBackup({ notes: { content: 'Plus ancien', updatedAt: 500_000_000_000 } }),
    )
    expect(summarySecond.notesUpdated).toBe(false)
  })
})
