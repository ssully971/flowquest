import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AdminPage } from './AdminPage'

describe('AdminPage — panneau Admin (§12)', () => {
  it('affiche l’onglet Citations par défaut', () => {
    render(<AdminPage />)
    expect(screen.getByRole('tab', { name: 'Citations' })).toHaveAttribute('aria-selected', 'true')
  })

  it('bascule vers l’onglet Nouveautés au clic', async () => {
    const user = userEvent.setup()
    render(<AdminPage />)

    await user.click(screen.getByRole('tab', { name: 'Nouveautés' }))

    expect(screen.getByRole('tab', { name: 'Nouveautés' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Citations' })).toHaveAttribute('aria-selected', 'false')
  })

  it('bascule vers l’onglet Support au clic', async () => {
    const user = userEvent.setup()
    render(<AdminPage />)

    await user.click(screen.getByRole('tab', { name: 'Support' }))

    expect(screen.getByRole('tab', { name: 'Support' })).toHaveAttribute('aria-selected', 'true')
  })
})
