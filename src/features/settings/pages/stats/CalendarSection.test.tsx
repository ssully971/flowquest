import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { CalendarSection } from './CalendarSection'

describe('CalendarSection — vues 6 mois / 1 an et unité heures / sessions (§9)', () => {
  it('affiche 182 jours par défaut (6 mois)', async () => {
    render(<CalendarSection dailyGoalMinutes={120} />)
    expect(await screen.findAllByRole('img')).toHaveLength(182)
  })

  it('bascule sur 365 jours au clic sur « 1 an »', async () => {
    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')

    await user.click(screen.getByRole('button', { name: '1 an' }))
    await screen.findAllByRole('img', {}, { timeout: 2000 })
    expect(screen.getAllByRole('img')).toHaveLength(365)
  })

  it('bascule l’unité sur « Sessions » sans changer le nombre de cellules', async () => {
    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')

    await user.click(screen.getByRole('button', { name: 'Sessions' }))
    expect(screen.getAllByRole('img')).toHaveLength(182)
  })

  it('reflète une session enregistrée en mode « Sessions »', async () => {
    const db = await getDb()
    const now = Date.now()
    await db.put('focusSessions', {
      id: 'calendar-section-session-1',
      kind: 'focus',
      plannedSeconds: 1500,
      actualSeconds: 1500,
      startedAt: now - 1500_000,
      endedAt: now,
      completed: true,
      taskId: null,
      syncedAt: null,
    })

    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')
    await user.click(screen.getByRole('button', { name: 'Sessions' }))

    const matches = await screen.findAllByRole('img', { name: /1 session/ })
    expect(matches.length).toBeGreaterThan(0)

    await db.delete('focusSessions', 'calendar-section-session-1')
  })
})
