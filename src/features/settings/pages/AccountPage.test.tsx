import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AccountPage } from './AccountPage'

function renderAccountPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AccountPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AccountPage — mode invité (aucune variable Supabase définie dans les tests)', () => {
  it('explique que les comptes ne sont pas configurés, sans casser le mode invité', () => {
    renderAccountPage()
    expect(
      screen.getByText(/Les comptes ne sont pas encore configurés sur ce déploiement/),
    ).toBeInTheDocument()
  })

  it("n'affiche ni formulaire de connexion ni formulaire d'inscription quand Supabase est absent", () => {
    renderAccountPage()
    expect(screen.queryByRole('button', { name: 'Se connecter' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Créer mon compte' })).not.toBeInTheDocument()
  })
})
