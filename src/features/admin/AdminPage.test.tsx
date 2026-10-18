import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AdminPage } from './AdminPage'

function renderAdminPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AdminPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AdminPage — panneau Admin (§12)', () => {
  it('affiche l’onglet Citations par défaut', () => {
    renderAdminPage()
    expect(screen.getByRole('tab', { name: 'Citations' })).toHaveAttribute('aria-selected', 'true')
  })

  it('bascule vers l’onglet Nouveautés au clic', async () => {
    const user = userEvent.setup()
    renderAdminPage()

    await user.click(screen.getByRole('tab', { name: 'Nouveautés' }))

    expect(screen.getByRole('tab', { name: 'Nouveautés' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Citations' })).toHaveAttribute('aria-selected', 'false')
  })

  it('bascule vers l’onglet Support au clic', async () => {
    const user = userEvent.setup()
    renderAdminPage()

    await user.click(screen.getByRole('tab', { name: 'Support' }))

    expect(screen.getByRole('tab', { name: 'Support' })).toHaveAttribute('aria-selected', 'true')
  })
})
