import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { CalendarSection } from './CalendarSection'

// Horloge figée : la fenêtre « année en cours » dépend du jour de l'année courant, donc
// un nombre de cellules attendu fixe n'est déterministe qu'avec une date de test figée.
// 15 juin 2026 est le 166ᵉ jour de l'année (31+28+31+30+31+15), 2026 n'étant pas bissextile.
const PINNED_DATE = new Date(2026, 5, 15)
const DAYS_ELAPSED_IN_2026 = 166
const DAYS_IN_2025 = 365

describe('CalendarSection — navigation par année civile et unité heures / sessions (§9)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(PINNED_DATE)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche l’année en cours, arrêtée au jour présent (pas de jours futurs)', async () => {
    render(<CalendarSection dailyGoalMinutes={120} />)
    expect(await screen.findAllByRole('img')).toHaveLength(DAYS_ELAPSED_IN_2026)
    expect(screen.getByText('2026')).toBeInTheDocument()
  })

  it('« Année suivante » est désactivé sur l’année en cours', async () => {
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')
    expect(screen.getByRole('button', { name: 'Année suivante' })).toBeDisabled()
  })

  it('« Année précédente » affiche l’année complète précédente', async () => {
    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')

    await user.click(screen.getByRole('button', { name: 'Année précédente' }))
    await screen.findAllByRole('img', {}, { timeout: 2000 })

    expect(screen.getByText('2025')).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(DAYS_IN_2025)
    expect(screen.getByRole('button', { name: 'Année suivante' })).not.toBeDisabled()
  })

  it('revenir en avant ramène sur l’année en cours, de nouveau bloquée', async () => {
    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')

    await user.click(screen.getByRole('button', { name: 'Année précédente' }))
    await screen.findAllByRole('img', {}, { timeout: 2000 })
    await user.click(screen.getByRole('button', { name: 'Année suivante' }))
    await screen.findAllByRole('img', {}, { timeout: 2000 })

    expect(screen.getByText('2026')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Année suivante' })).toBeDisabled()
  })

  it('bascule l’unité sur « Sessions » sans changer le nombre de cellules', async () => {
    const user = userEvent.setup()
    render(<CalendarSection dailyGoalMinutes={120} />)
    await screen.findAllByRole('img')

    await user.click(screen.getByRole('button', { name: 'Sessions' }))
    expect(screen.getAllByRole('img')).toHaveLength(DAYS_ELAPSED_IN_2026)
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
      pillarId: null,
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
