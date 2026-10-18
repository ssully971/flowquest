import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { ActiveTaskProvider } from '../ActiveTaskProvider'
import { TasksPanel } from './TasksPanel'

// jsdom n'implémente pas le contexte canvas 2D : la boucle d'animation interne de
// canvas-confetti y jette une exception non liée au code de l'app (§8, confettis).
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

function renderPanel(open = true) {
  const onClose = () => {}
  return render(
    <ActiveTaskProvider>
      <div>
        <button type="button">Déclencheur</button>
        <div className="relative">
          <TasksPanel open={open} onClose={onClose} />
        </div>
      </div>
    </ActiveTaskProvider>,
  )
}

beforeEach(async () => {
  window.localStorage.clear()
  const db = await getDb()
  const keys = await db.getAllKeys('tasks')
  await Promise.all(keys.map((key) => db.delete('tasks', key)))
})

describe('TasksPanel', () => {
  it("affiche l'état vide quand il n'y a aucune tâche", async () => {
    renderPanel()
    expect(await screen.findByText('Aucune tâche pour l’instant.')).toBeInTheDocument()
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

  it('supprime une tâche', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.type(screen.getByPlaceholderText('Nouvelle tâche…'), 'À retirer')
    await user.click(screen.getByRole('button', { name: 'Ajouter' }))
    await screen.findByText('À retirer')

    await user.click(screen.getByRole('button', { name: 'Supprimer la tâche' }))
    await waitFor(() => {
      expect(screen.queryByText('À retirer')).not.toBeInTheDocument()
    })
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
