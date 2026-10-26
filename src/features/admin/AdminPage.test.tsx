import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AdminPage } from './AdminPage'

function renderAdminPage() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AdminPage />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

describe('AdminPage — panneau Admin refait (lot I2)', () => {
  it('affiche la section Vue d’ensemble par défaut', () => {
    renderAdminPage()
    expect(screen.getByRole('tab', { name: 'Vue d’ensemble' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('heading', { name: 'Vue d’ensemble', level: 1 })).toBeInTheDocument()
  })

  it('bascule vers Fonctionnalités au clic', async () => {
    const user = userEvent.setup()
    renderAdminPage()

    await user.click(screen.getByRole('tab', { name: 'Fonctionnalités' }))

    expect(screen.getByRole('tab', { name: 'Fonctionnalités' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(screen.getByRole('tab', { name: 'Vue d’ensemble' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('bascule vers Contenu puis affiche les sous-onglets Citations/Nouveautés', async () => {
    const user = userEvent.setup()
    renderAdminPage()

    await user.click(screen.getByRole('tab', { name: 'Contenu' }))

    expect(screen.getByRole('heading', { name: 'Contenu', level: 1 })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Citations' })).toHaveAttribute('aria-selected', 'true')
    await user.click(screen.getByRole('tab', { name: 'Nouveautés' }))
    expect(screen.getByRole('tab', { name: 'Nouveautés' })).toHaveAttribute('aria-selected', 'true')
  })

  it('bascule vers Support et vers Journal au clic', async () => {
    const user = userEvent.setup()
    renderAdminPage()

    await user.click(screen.getByRole('tab', { name: 'Support' }))
    expect(screen.getByRole('tab', { name: 'Support' })).toHaveAttribute('aria-selected', 'true')

    await user.click(screen.getByRole('tab', { name: 'Journal' }))
    expect(screen.getByRole('tab', { name: 'Journal' })).toHaveAttribute('aria-selected', 'true')
  })
})
