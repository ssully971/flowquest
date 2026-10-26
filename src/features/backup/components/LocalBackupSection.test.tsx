import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import * as localBackup from '../local-backup'
import { LocalBackupSection } from './LocalBackupSection'

function renderSection() {
  return render(
    <ToastProvider>
      <LocalBackupSection />
    </ToastProvider>,
  )
}

describe('LocalBackupSection — export et import de la sauvegarde locale (LOT 1)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('déclenche l’export au clic sur le bouton Exporter', async () => {
    const exportSpy = vi.spyOn(localBackup, 'exportLocalBackup').mockResolvedValue(undefined)
    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Exporter mes données' }))
    await waitFor(() => expect(exportSpy).toHaveBeenCalled())
  })

  it('affiche une erreur quand le fichier importé n’est pas une sauvegarde Fokitsu', async () => {
    renderSection()
    const file = new File(['{ "app": "autre" }'], 'sauvegarde.json', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('Ce fichier ne vient pas de Fokitsu.'),
    ).toBeInTheDocument()
  })

  it('affiche un résumé après un import réussi', async () => {
    const backup = {
      app: 'flowquest' as const,
      schemaVersion: localBackup.BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: [],
      notes: null,
      focusSessions: [],
      settings: null,
    }
    vi.spyOn(localBackup, 'importBackup').mockResolvedValue({
      tasksAdded: 2,
      tasksSkipped: 0,
      focusSessionsAdded: 1,
      focusSessionsSkipped: 0,
      notesUpdated: false,
      settingsUpdated: false,
    })

    renderSection()
    const file = new File([JSON.stringify(backup)], 'sauvegarde.json', { type: 'application/json' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement

    fireEvent.change(input, { target: { files: [file] } })

    expect(
      await screen.findByText('2 tâche(s) ajoutée(s) · 1 session(s) ajoutée(s)'),
    ).toBeInTheDocument()
  })
})
