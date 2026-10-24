import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { Friend } from '../types'
import { FriendCard } from './FriendCard'

function friend(overrides: Partial<Friend> = {}): Friend {
  return {
    friendshipId: 'f1',
    id: 'u1',
    username: 'ami',
    displayName: 'Mon Ami',
    avatarUrl: null,
    avatarVersion: 0,
    since: '2026-01-01T00:00:00Z',
    live: { state: null, startedAt: null, durationMs: null, isOnline: false },
    ...overrides,
  }
}

describe('FriendCard — statut en direct et encouragements (LOT F2)', () => {
  it('n’affiche aucun point de statut quand l’ami est hors ligne', () => {
    render(<FriendCard friend={friend()} onRemove={vi.fn()} onBlock={vi.fn()} onReport={vi.fn()} onCheer={vi.fn()} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('affiche « En focus depuis X min » quand l’ami est en ligne et en focus', () => {
    const startedAt = new Date(Date.now() - 12 * 60_000).toISOString()
    render(
      <FriendCard
        friend={friend({ live: { state: 'focus', startedAt, durationMs: 1500000, isOnline: true } })}
        onRemove={vi.fn()}
        onBlock={vi.fn()}
        onReport={vi.fn()}
        onCheer={vi.fn()}
      />,
    )
    expect(screen.getByText(/En focus depuis 12 min/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('affiche « En pause depuis X min » quand l’ami est en ligne et en pause', () => {
    const startedAt = new Date(Date.now() - 3 * 60_000).toISOString()
    render(
      <FriendCard
        friend={friend({ live: { state: 'pause', startedAt, durationMs: 300000, isOnline: true } })}
        onRemove={vi.fn()}
        onBlock={vi.fn()}
        onReport={vi.fn()}
        onCheer={vi.fn()}
      />,
    )
    expect(screen.getByText(/En pause depuis 3 min/)).toBeInTheDocument()
  })

  it('jamais aucun détail sur la tâche en cours (seulement l’état, jamais son contenu)', () => {
    const startedAt = new Date().toISOString()
    render(
      <FriendCard
        friend={friend({ live: { state: 'focus', startedAt, durationMs: 1500000, isOnline: true } })}
        onRemove={vi.fn()}
        onBlock={vi.fn()}
        onReport={vi.fn()}
        onCheer={vi.fn()}
      />,
    )
    expect(screen.queryByText(/tâche/i)).not.toBeInTheDocument()
  })

  it('envoyer un encouragement appelle onCheer avec l’id de l’ami et l’emoji choisi', async () => {
    const user = userEvent.setup()
    const onCheer = vi.fn()
    render(<FriendCard friend={friend()} onRemove={vi.fn()} onBlock={vi.fn()} onReport={vi.fn()} onCheer={onCheer} />)

    await user.click(screen.getByRole('button', { name: 'Encourager' }))
    await user.click(screen.getByText('💪'))

    expect(onCheer).toHaveBeenCalledWith('u1', '💪')
  })

  it('retirer demande confirmation puis appelle onRemove', async () => {
    const user = userEvent.setup()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onRemove = vi.fn()
    render(<FriendCard friend={friend()} onRemove={onRemove} onBlock={vi.fn()} onReport={vi.fn()} onCheer={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Plus d’options' }))
    await user.click(screen.getByRole('menuitem', { name: 'Retirer' }))

    expect(confirmSpy).toHaveBeenCalled()
    expect(onRemove).toHaveBeenCalledWith('u1')
    confirmSpy.mockRestore()
  })
})
