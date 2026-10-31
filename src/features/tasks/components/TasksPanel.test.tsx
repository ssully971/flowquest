import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { getDb } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { ActiveTaskProvider } from '../ActiveTaskProvider'
import { TasksPanel } from './TasksPanel'

// jsdom n'implémente pas le contexte canvas 2D : la boucle d'animation interne de
// canvas-confetti y jette une exception non liée au code de l'app (§8, confettis).
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

function renderPanel(open = true) {
  const onClose = () => {}
  return render(
    <ToastProvider>
      <ExtrasSettingsProvider>
        <ActiveTaskProvider>
          <div>
            <button type="button">Déclencheur</button>
            <div className="relative">
              <TasksPanel open={open} onClose={onClose} />
            </div>
          </div>
        </ActiveTaskProvider>
      </ExtrasSettingsProvider>
    </ToastProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  const db = await getDb()
  const keys = await db.getAllKeys('tasks')
  await Promise.all(keys.map((key) => db.delete('tasks', key)))
  // Réglage par défaut (LOT H1, §5) : confirmation activée — chaque test qui supprime
  // une tâche sans tester explicitement l'annulation doit pouvoir confirmer.
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

function disableDeleteConfirmation() {
  window.localStorage.setItem(
    'flowquest.extrasSettings',
    JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, confirmTaskDeletion: false }),
  )
}

describe('TasksPanel', () => {
  it("affiche l'état vide quand il n'y a aucune tâche", async () => {
    renderPanel()
    expect(await screen.findByText('Rien à faire, pour l’instant')).toBeInTheDocument()
  })

  it('ajoute une tâche via le formulaire et la coche', async () => {
    const user = userEvent.setup()
    renderPanel()

    const input = screen.getByPlaceholderText('Nouvelle tâche…')
    await user.type(input, 'Lire un chapitre')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))

    const checkbox = await screen.findByRole('checkbox', { name: 'Marquer comme terminée' })
    expect(checkbox).toBeInTheDocument()

    await user.click(checkbox)
    expect(
      await screen.findByRole('checkbox', { name: 'Marquer comme à faire' }),
    ).toBeInTheDocument()
  })

  it('supprime une tâche après confirmation (LOT H1, §5, réglage activé par défaut)', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'À retirer')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('À retirer')

    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer la tâche' }))
    expect(window.confirm).toHaveBeenCalledWith('Supprimer cette tâche ?')
    await waitFor(() => {
      expect(screen.queryByText('À retirer')).not.toBeInTheDocument()
    })
  })

  it('archive une tâche, la retrouve dans les archives et la restaure', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'À archiver')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('À archiver')

    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))
    await user.click(screen.getByRole('button', { name: 'Archiver la tâche' }))
    await waitFor(() => expect(screen.queryByText('À archiver')).not.toBeInTheDocument())
    expect(window.confirm).not.toHaveBeenCalled()

    await user.click(await screen.findByRole('button', { name: 'Archives (1)' }))
    expect(await screen.findByText('À archiver')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Restaurer la tâche : À archiver' }))
    await user.click(screen.getByRole('button', { name: 'Retour aux tâches' }))
    expect(await screen.findByText('À archiver')).toBeInTheDocument()
  })

  it('applique le style de panneau choisi dans les réglages (papier par défaut, verre au choix)', async () => {
    const { unmount } = renderPanel()
    expect(await screen.findByRole('dialog', { name: 'Tâches' })).toHaveAttribute(
      'data-panel-style',
      'paper',
    )
    unmount()

    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, panelStyle: 'glass' }),
    )
    renderPanel()
    expect(await screen.findByRole('dialog', { name: 'Tâches' })).toHaveAttribute(
      'data-panel-style',
      'glass',
    )
  })

  it('ne supprime rien si on refuse la confirmation (LOT H1, §5)', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'À garder')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('À garder')

    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer la tâche' }))
    expect(screen.getByText('À garder')).toBeInTheDocument()
  })

  it('supprime immédiatement sans confirmer quand le réglage est désactivé, avec un toast « Annuler » (LOT H1, §5)', async () => {
    disableDeleteConfirmation()
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'Suppression rapide')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('Suppression rapide')

    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))
    await user.click(screen.getByRole('button', { name: 'Supprimer la tâche' }))
    expect(window.confirm).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByText('Suppression rapide')).not.toBeInTheDocument()
    })

    expect(await screen.findByText('Tâche supprimée')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(await screen.findByText('Suppression rapide')).toBeInTheDocument()
  })

  it('déclenche les confettis en cochant la dernière tâche restante (§8)', async () => {
    const confetti = (await import('canvas-confetti')).default
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'Première')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('Première')
    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'Deuxième')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('Deuxième')

    const checkboxes = await screen.findAllByRole('checkbox', { name: 'Marquer comme terminée' })
    expect(checkboxes).toHaveLength(2)

    await user.click(checkboxes[0])
    await waitFor(() => expect(confetti).not.toHaveBeenCalled())

    await user.click(checkboxes[1])
    await waitFor(() => expect(confetti).toHaveBeenCalledTimes(1))
  })

  it('choisit une tâche comme active, puis peut la retirer', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'Tâche active')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('Tâche active')

    const setActiveButton = screen.getByRole('button', { name: 'Choisir comme tâche active' })
    await user.click(setActiveButton)

    expect(
      await screen.findByRole('button', { name: 'Retirer comme tâche active' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
