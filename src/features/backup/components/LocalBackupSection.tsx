import type { ChangeEvent } from 'react'
import { useRef, useState } from 'react'

import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { BackupParseError, exportLocalBackup, importBackup, parseBackupFile } from '../local-backup'
import type { ImportSummary } from '../local-backup'

function buildImportSummaryMessage(summary: ImportSummary): string {
  const parts: string[] = []
  if (summary.tasksAdded > 0) {
    parts.push(`${summary.tasksAdded} ${strings.backup.importSummaryTasksAdded}`)
  }
  if (summary.focusSessionsAdded > 0) {
    parts.push(`${summary.focusSessionsAdded} ${strings.backup.importSummarySessionsAdded}`)
  }
  if (summary.notesUpdated) parts.push(strings.backup.importSummaryNotesUpdated)
  if (summary.settingsUpdated) parts.push(strings.backup.importSummarySettingsUpdated)
  return parts.length > 0 ? parts.join(' · ') : strings.backup.importSummaryNothingNew
}

export function LocalBackupSection() {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await exportLocalBackup()
    } catch (error) {
      console.error('[Flowquest] Échec de l’export de la sauvegarde locale :', error)
      showToast({ type: 'error', message: strings.backup.exportError })
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsImporting(true)
    try {
      const raw = await file.text()
      const backup = parseBackupFile(raw)
      const summary = await importBackup(backup)
      showToast({ type: 'success', message: buildImportSummaryMessage(summary) })
    } catch (error) {
      if (error instanceof BackupParseError) {
        showToast({ type: 'error', message: error.message })
      } else {
        console.error('[Flowquest] Échec de l’import de la sauvegarde locale :', error)
        showToast({ type: 'error', message: strings.backup.importError })
      }
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-5">
      <p className="text-sm font-semibold text-[var(--panel-text)]">{strings.backup.title}</p>
      <p className="text-sm text-[var(--panel-muted)]">{strings.backup.description}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting}
          className="h-10 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-50"
        >
          {isExporting ? strings.backup.exporting : strings.backup.export}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
          className="h-10 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-50"
        >
          {isImporting ? strings.backup.importing : strings.backup.import}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => void handleFileSelected(event)}
        />
      </div>
    </div>
  )
}
