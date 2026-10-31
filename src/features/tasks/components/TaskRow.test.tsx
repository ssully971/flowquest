import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PillarRecord, TaskRecord } from '@/shared/storage/db'

import { TaskRow } from './TaskRow'

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'a',
    title: 'Réviser',
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: false,
    doneAt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function renderRow(task: TaskRecord, onUpdateDetails = vi.fn(), pillars: PillarRecord[] = []) {
  return {
    onUpdateDetails,
    ...render(
      <ul>
        <TaskRow
          task={task}
          depth={0}
          isActive={false}
          onToggleDone={vi.fn()}
          onRename={vi.fn()}
          onRemove={vi.fn()}
          onSetActive={vi.fn()}
          onUpdateDetails={onUpdateDetails}
          onAddSubtask={vi.fn()}
          onDragPointerDown={vi.fn()}
          pillars={pillars}
        />
      </ul>,
    ),
  }
}

describe('TaskRow — emoji, couleur, durée estimée (lot 6, §8)', () => {
  it('le panneau d’options est replié par défaut', () => {
    renderRow(makeTask())
    expect(screen.queryByText('Emoji')).not.toBeInTheDocument()
  })

  it('déplie les options au clic sur le chevron', async () => {
    const user = userEvent.setup()
    renderRow(makeTask())

    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    expect(screen.getByText('Emoji')).toBeInTheDocument()
    expect(screen.getByText('Couleur')).toBeInTheDocument()
    expect(screen.getByText('Durée estimée')).toBeInTheDocument()
  })

  it('choisit un emoji', async () => {
    const user = userEvent.setup()
    const { onUpdateDetails } = renderRow(makeTask())
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    await user.click(screen.getByRole('button', { name: '📚' }))
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { emoji: '📚' })
  })

  it('reclique sur l’emoji déjà choisi pour le retirer', async () => {
    const user = userEvent.setup()
    const { onUpdateDetails } = renderRow(makeTask({ emoji: '📚' }))
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    await user.click(screen.getByRole('button', { name: '📚' }))
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { emoji: null })
  })

  it('affiche l’emoji choisi dans la ligne repliée', () => {
    renderRow(makeTask({ emoji: '🎯' }))
    expect(screen.getByText('🎯')).toBeInTheDocument()
  })

  it('choisit une couleur', async () => {
    const user = userEvent.setup()
    const { onUpdateDetails } = renderRow(makeTask())
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    await user.click(screen.getByRole('button', { name: '#F2555A' }))
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { color: '#F2555A' })
  })

  it('saisit une durée estimée', async () => {
    const user = userEvent.setup()
    const { onUpdateDetails } = renderRow(makeTask())
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    fireEvent.change(screen.getByPlaceholderText('Durée (min)'), { target: { value: '25' } })
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { etaMinutes: 25 })
  })

  it('affiche la durée estimée dans la ligne repliée', () => {
    renderRow(makeTask({ etaMinutes: 25 }))
    expect(screen.getByText('25 min')).toBeInTheDocument()
  })
})

const PILLAR: PillarRecord = {
  id: 'p1',
  name: 'Médecine',
  color: '#4AC7C0',
  currentXp: 0,
  level: 1,
  createdAt: 0,
  archivedAt: null,
  goalLevel: null,
  goalDeadline: null,
}

describe('TaskRow — rattachement à un pilier', () => {
  it('n’affiche pas de sélecteur de pilier quand aucun pilier n’est proposé', async () => {
    const user = userEvent.setup()
    renderRow(makeTask())
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))
    expect(screen.queryByRole('group', { name: 'Pilier' })).not.toBeInTheDocument()
  })

  it('rattache puis détache la tâche à un pilier', async () => {
    const user = userEvent.setup()
    const { onUpdateDetails } = renderRow(makeTask(), vi.fn(), [PILLAR])
    await user.click(screen.getByRole('button', { name: 'Options de la tâche' }))

    await user.click(screen.getByRole('button', { name: 'Médecine' }))
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { pillarId: 'p1' })

    await user.click(screen.getByRole('button', { name: 'Aucun' }))
    expect(onUpdateDetails).toHaveBeenCalledWith('a', { pillarId: null })
  })

  it('affiche le nom du pilier dans la ligne repliée', () => {
    renderRow(makeTask({ pillarId: 'p1' }), vi.fn(), [PILLAR])
    expect(screen.getByText('Médecine')).toBeInTheDocument()
  })
})
