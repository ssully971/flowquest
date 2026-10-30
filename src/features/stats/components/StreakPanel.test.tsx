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
      // Minuit LOCAL : l'étiquette vient du jour de la semaine local, pas de l'UTC.
      {
        dayStart: new Date(2026, 0, 14).getTime(),
        focusSeconds: 0,
        sessionsCount: 0,
        goalMet: false,
      },
      {
        dayStart: new Date(2026, 0, 15).getTime(),
        focusSeconds: 7200,
        sessionsCount: 3,
        goalMet: true,
      },
    ])
    renderPanel({ stats: stats({ currentStreakDays: 1, longestStreakDays: 1 }) })

    expect(screen.getByText('Les 7 derniers jours')).toBeInTheDocument()
    // 2026-01-14 = mercredi, 2026-01-15 = jeudi
    expect(screen.getByText('M')).toBeInTheDocument()
    expect(screen.getByText('J')).toBeInTheDocument()
  })

  it('affiche les 7 jours avec leur état, dont un jour gelé', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    mockWeek.mockReturnValueOnce([
      { dayStart: yesterday.getTime(), focusSeconds: 0, sessionsCount: 0, goalMet: false },
      { dayStart: today.getTime(), focusSeconds: 0, sessionsCount: 0, goalMet: false },
    ])
    renderPanel({
      stats: stats({
        currentStreakDays: 4,
        longestStreakDays: 4,
        freezes: {
          stock: 1,
          progressSeconds: 12000,
          capped: false,
          usedDays: [yesterday.getTime()],
        },
      }),
    })

    expect(screen.getByLabelText(/: gelé$/)).toBeInTheDocument()
    expect(screen.getByLabelText(/: aujourd’hui, en cours$/)).toBeInTheDocument()
  })

  it('affiche le stock de gels, la progression « 3 h 20 / 10 h » et l’historique', async () => {
    const user = userEvent.setup()
    const used = new Date(2026, 0, 14).getTime()
    renderPanel({
      stats: stats({
        currentStreakDays: 2,
        longestStreakDays: 2,
        freezes: { stock: 2, progressSeconds: 12000, capped: false, usedDays: [used] },
      }),
    })

    expect(screen.getByLabelText('2 gels sur 3')).toBeInTheDocument()
    expect(screen.getByText('3 h 20 / 10 h')).toBeInTheDocument()
    expect(screen.getByText(/mercredi 14 janvier/)).toBeInTheDocument()
    expect(screen.queryByText(/Stock plein/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Comment ça marche ?' }))
    expect(screen.getByText(/1 gel pour 10 h de focus/)).toBeInTheDocument()
  })

  it('stock plein : message clair, la progression continue', () => {
    renderPanel({
      stats: stats({
        currentStreakDays: 2,
        longestStreakDays: 2,
        freezes: { stock: 3, progressSeconds: 3600, capped: true, usedDays: [] },
      }),
    })

    expect(screen.getByText(/Stock plein/)).toBeInTheDocument()
    expect(screen.getByText('1 h / 10 h')).toBeInTheDocument()
    expect(screen.getByText('Aucun gel utilisé pour l’instant.')).toBeInTheDocument()
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
