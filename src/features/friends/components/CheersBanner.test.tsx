import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { UnreadCheer } from '../types'
import { CheersBanner } from './CheersBanner'

const CHEER: UnreadCheer = {
  id: 'c1',
  emoji: '🔥',
  createdAt: '2026-01-01T00:00:00Z',
  sender: { id: 'u2', username: 'ami', displayName: 'Mon Ami', avatarUrl: null, avatarVersion: 0 },
}

describe('CheersBanner — bandeau non bloquant (LOT F2)', () => {
  it('ne rend rien sans encouragement', () => {
    const { container } = render(<CheersBanner cheers={[]} onDismiss={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche chaque encouragement avec son expéditeur et son emoji', () => {
    render(<CheersBanner cheers={[CHEER]} onDismiss={vi.fn()} />)
    expect(screen.getByText('Mon Ami', { exact: false })).toBeInTheDocument()
    expect(screen.getByText(/🔥/)).toBeInTheDocument()
  })

  it('fermer appelle onDismiss', async () => {
    const user = userEvent.setup()
    const onDismiss = vi.fn()
    render(<CheersBanner cheers={[CHEER]} onDismiss={onDismiss} />)

    await user.click(screen.getByRole('button', { name: 'Fermer' }))

    expect(onDismiss).toHaveBeenCalled()
  })
})
