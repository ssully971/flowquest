import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { DashboardStats, DayFocus } from '../compute-stats'
import { StreakPanel } from './StreakPanel'

const mockWeek = vi.fn<() => DayFocus[] | null>(() => [])

vi.mock('../useDailyFocusHistory', () => ({
  useDailyFocusHistory: () => mockWeek(),
}))

function stats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    todayFocusSeconds: 0,
    weekFocusSeconds: 0,
    currentStreakDays: 0,
    longestStreakDays: 0,
    dailyGoalMinutes: 120,
    ...overrides,
  }
}

interface RenderPanelProps {
  open?: boolean
  onClose?: () => void
  stats?: DashboardStats | null
}

function renderPanel(props: RenderPanelProps = {}) {
  const onClose = props.onClose ?? vi.fn()
  return {
    onClose,
    ...render(
      <div>
        <button type="button">Déclencheur</button>
        <div className="relative">
          <StreakPanel open={props.open ?? true} onClose={onClose} stats={props.stats ?? null} />
        </div>
      </div>,
    ),
  }
}

describe('StreakPanel', () => {
  it('ne s’affiche pas quand fermé', () => {
    renderPanel({ open: false })
    expect(screen.queryByRole('dialog', { name: 'Série' })).not.toBeInTheDocument()
  })

  it('affiche le message vide quand aucune série n’a jamais démarré', () => {
    renderPanel({ stats: stats() })
    expect(
      screen.getByText('Termine ta première session de focus pour démarrer ta série.'),
    ).toBeInTheDocument()
  })

  it('affiche la série actuelle, le record et le prochain palier', () => {
    renderPanel({ stats: stats({ currentStreakDays: 5, longestStreakDays: 9 }) })

    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('9')).toBeInTheDocument()
    expect(screen.getByText('Série actuelle')).toBeInTheDocument()
    expect(screen.getByText('Record')).toBeInTheDocument()
    expect(screen.getByText(/Prochain palier : 7 jours \(dans 2 jours\)/)).toBeInTheDocument()
  })

  it('affiche une pastille par jour de la semaine, étiquetée par jour', () => {
    mockWeek.mockReturnValueOnce([
      { dayStart: Date.UTC(2026, 0, 14), focusSeconds: 0, goalMet: false },
      { dayStart: Date.UTC(2026, 0, 15), focusSeconds: 7200, goalMet: true },
    ])
    renderPanel({ stats: stats({ currentStreakDays: 1, longestStreakDays: 1 }) })

    expect(screen.getByText('Les 7 derniers jours')).toBeInTheDocument()
    // 2026-01-14 = mercredi, 2026-01-15 = jeudi
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('ferme le panneau via Échap', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel({ stats: stats() })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('ferme le panneau via un clic en dehors', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel({ stats: stats() })

    await user.click(screen.getByRole('button', { name: 'Déclencheur' }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
