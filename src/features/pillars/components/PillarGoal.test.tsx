import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { PillarRecord } from '@/shared/storage/db'

import { PillarGoal } from './PillarGoal'

function pillar(overrides: Partial<PillarRecord> = {}): PillarRecord {
  return {
    id: 'p1',
    name: 'Sport',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: Date.now(),
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
    ...overrides,
  }
}

describe('PillarGoal — aucun objectif fixé (lot 4, §4)', () => {
  it('propose de fixer un objectif', () => {
    render(<PillarGoal pillar={pillar()} onSetGoal={vi.fn()} onClearGoal={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Fixer un objectif/ })).toBeInTheDocument()
  })

  it('ouvre le formulaire au clic, avec le niveau suivant pré-rempli', async () => {
    const user = userEvent.setup()
    render(<PillarGoal pillar={pillar({ level: 3 })} onSetGoal={vi.fn()} onClearGoal={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Fixer un objectif/ }))
    expect(screen.getByLabelText(/Niveau visé/)).toHaveValue(4)
  })

  it('enregistre l’objectif saisi', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()
    render(<PillarGoal pillar={pillar({ level: 1 })} onSetGoal={onSetGoal} onClearGoal={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Fixer un objectif/ }))
    const levelInput = screen.getByLabelText(/Niveau visé/)
    await user.clear(levelInput)
    await user.type(levelInput, '5')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSetGoal).toHaveBeenCalledWith(5, null)
  })

  it('refuse un niveau visé inférieur ou égal au niveau actuel', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()
    render(<PillarGoal pillar={pillar({ level: 3 })} onSetGoal={onSetGoal} onClearGoal={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Fixer un objectif/ }))
    const levelInput = screen.getByLabelText(/Niveau visé/)
    await user.clear(levelInput)
    await user.type(levelInput, '3')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSetGoal).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('niveau supérieur')
  })
})

describe('PillarGoal — objectif en cours (lot 4, §4)', () => {
  it('affiche le niveau visé et une barre de progression', () => {
    render(
      <PillarGoal
        pillar={pillar({ level: 1, currentXp: 300, goalLevel: 3 })}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByText(/Objectif : niveau 3/)).toBeInTheDocument()
  })

  it('affiche le temps de focus moyen par jour nécessaire si une date limite est fixée', () => {
    const deadline = Date.now() + 10 * 24 * 60 * 60 * 1000
    render(
      <PillarGoal
        pillar={pillar({ level: 1, currentXp: 600, goalLevel: 3, goalDeadline: deadline })}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByText(/\/jour pour y arriver/)).toBeInTheDocument()
  })

  it('affiche « Objectif atteint » une fois le niveau visé franchi, sans barre de progression', () => {
    render(
      <PillarGoal
        pillar={pillar({ level: 3, currentXp: 2000, goalLevel: 3 })}
        onSetGoal={vi.fn()}
        onClearGoal={vi.fn()}
      />,
    )
    expect(screen.getByText(/Objectif atteint/)).toBeInTheDocument()
    expect(screen.queryByText(/\/jour pour y arriver/)).not.toBeInTheDocument()
  })

  it('annule l’objectif au clic sur Annuler l’objectif', async () => {
    const user = userEvent.setup()
    const onClearGoal = vi.fn()
    render(
      <PillarGoal
        pillar={pillar({ goalLevel: 5 })}
        onSetGoal={vi.fn()}
        onClearGoal={onClearGoal}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Annuler l’objectif' }))
    expect(onClearGoal).toHaveBeenCalled()
  })

  it('permet de modifier un objectif déjà fixé', async () => {
    const user = userEvent.setup()
    const onSetGoal = vi.fn()
    render(
      <PillarGoal
        pillar={pillar({ level: 1, goalLevel: 3 })}
        onSetGoal={onSetGoal}
        onClearGoal={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Modifier l’objectif' }))
    const levelInput = screen.getByLabelText(/Niveau visé/)
    await user.clear(levelInput)
    await user.type(levelInput, '6')
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(onSetGoal).toHaveBeenCalledWith(6, null)
  })
})
