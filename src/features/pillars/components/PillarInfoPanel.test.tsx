import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PillarInfoPanel } from './PillarInfoPanel'
import { PillarTierBadge } from './PillarTierBadge'

describe('PillarInfoPanel', () => {
  it('ne s’affiche pas fermé', () => {
    render(<PillarInfoPanel open={false} onClose={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('explique ce qu’est un pilier, l’XP, la table niveau/heures et les déblocages', () => {
    render(<PillarInfoPanel open onClose={vi.fn()} />)

    expect(screen.getByRole('dialog', { name: 'Les piliers de vie' })).toBeInTheDocument()
    expect(screen.getByText('C’est quoi, un pilier ?')).toBeInTheDocument()
    expect(screen.getByText(/10 XP au pilier/)).toBeInTheDocument()
    // Table : niveau 5 = 10 h, niveau 10 = 45 h (nombres triangulaires).
    const row5 = screen.getByRole('cell', { name: '5' }).closest('tr')!
    expect(row5).toHaveTextContent('10 h')
    expect(row5).toHaveTextContent('Apprenti')
    expect(screen.getByRole('cell', { name: '10' }).closest('tr')).toHaveTextContent('45 h')
    expect(screen.getByText(/titre de pilier et son badge/)).toBeInTheDocument()
    expect(screen.getByText('Comment lier une session à un pilier')).toBeInTheDocument()
  })

  it('se ferme via le bouton et via Échap', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PillarInfoPanel open onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Fermer l’explication' }))
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('PillarTierBadge', () => {
  it('affiche le titre du palier, ou seulement une info-bulle sans titre', () => {
    const { rerender } = render(<PillarTierBadge level={12} />)
    expect(screen.getByText('Expert')).toBeInTheDocument()

    rerender(<PillarTierBadge level={12} showTitle={false} />)
    expect(screen.queryByText('Expert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Expert, niveau 12')).toBeInTheDocument()
  })
})
