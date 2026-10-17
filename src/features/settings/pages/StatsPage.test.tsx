import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { StatsPage } from './StatsPage'

async function clearFocusSessions() {
  const db = await getDb()
  const keys = await db.getAllKeys('focusSessions')
  await Promise.all(keys.map((key) => db.delete('focusSessions', key)))
}

describe('StatsPage — objectif quotidien ajustable', () => {
  it('affiche l’objectif courant et le message vide tant qu’aucune session n’est enregistrée', async () => {
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={vi.fn()} />)

    expect(await screen.findByText('0 min / 120 min')).toBeInTheDocument()
    expect(
      screen.getByText('Termine ta première session de focus pour voir tes statistiques ici.'),
    ).toBeInTheDocument()
  })

  it('augmente l’objectif de 15 min au clic sur +', async () => {
    const user = userEvent.setup()
    const onDailyGoalChange = vi.fn()
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={onDailyGoalChange} />)

    await user.click(screen.getByRole('button', { name: 'Augmenter l’objectif quotidien' }))
    expect(onDailyGoalChange).toHaveBeenCalledWith(135)
  })

  it('diminue l’objectif de 15 min au clic sur -', async () => {
    const user = userEvent.setup()
    const onDailyGoalChange = vi.fn()
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={onDailyGoalChange} />)

    await user.click(screen.getByRole('button', { name: 'Diminuer l’objectif quotidien' }))
    expect(onDailyGoalChange).toHaveBeenCalledWith(105)
  })

  it('désactive le bouton - à la borne basse et + à la borne haute', () => {
    const { rerender } = render(<StatsPage dailyGoalMinutes={15} onDailyGoalChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Diminuer l’objectif quotidien' })).toBeDisabled()

    rerender(<StatsPage dailyGoalMinutes={480} onDailyGoalChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Augmenter l’objectif quotidien' })).toBeDisabled()
  })
})

describe('StatsPage — calendrier de régularité et tendance (§9 du cahier des charges)', () => {
  afterEach(async () => {
    await clearFocusSessions()
  })

  it('affiche le calendrier et la tendance une fois l’historique chargé, même sans session', async () => {
    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={vi.fn()} />)

    expect(await screen.findByText('Calendrier de focus')).toBeInTheDocument()
    expect(screen.getByText('Tendance de focus')).toBeInTheDocument()
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })

  it('reflète une session enregistrée dans le calendrier', async () => {
    const db = await getDb()
    const now = Date.now()
    await db.put('focusSessions', {
      id: 'stats-page-session-1',
      kind: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: now - 1500_000,
      endedAt: now,
      completed: true,
      taskId: null,
      syncedAt: null,
    })

    render(<StatsPage dailyGoalMinutes={120} onDailyGoalChange={vi.fn()} />)

    await screen.findByText('Calendrier de focus')
    const matches = await screen.findAllByRole('img', { name: /25 min/ })
    expect(matches.length).toBeGreaterThan(0)
  })
})
