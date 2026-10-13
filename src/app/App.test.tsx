import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { App } from './App'

beforeEach(() => {
  window.localStorage.clear()
})

describe('App', () => {
  it('affiche l’accueil par défaut avec le cadre commun (tâches, notes, série, mode, réglages, plein écran)', () => {
    render(<App />)

    expect(screen.getByRole('radio', { name: 'Accueil' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('button', { name: 'Tâches' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Bloc-notes' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Réglages' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Plein écran' })).toBeEnabled()
  })

  it('bascule vers Focus et affiche le minuteur une fois restauré', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('radio', { name: 'Focus' }))
    expect(await screen.findByText('Sur quoi te concentres-tu ?')).toBeInTheDocument()
  })

  it('ouvre le panneau de réglages sur la page Thèmes et le ferme via Échap', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: 'Réglages' }))
    expect(await screen.findByRole('dialog', { name: 'Réglages' })).toBeInTheDocument()
    expect(screen.getAllByText('Thèmes').length).toBeGreaterThan(0)

    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Réglages' })).not.toBeInTheDocument()
    })
  })
})
