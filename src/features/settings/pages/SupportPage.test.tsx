import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { SupportPage } from './SupportPage'

function renderSupportPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <SupportPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('SupportPage — mode invité (aucune variable Supabase définie dans les tests)', () => {
  it('explique que le formulaire nécessite une connexion internet, sans casser le mode invité', () => {
    renderSupportPage()
    expect(
      screen.getByText('Le formulaire de support nécessite une connexion internet.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Envoyer' })).not.toBeInTheDocument()
  })

  it('affiche toujours les liens utiles et la version de l’app', () => {
    renderSupportPage()
    expect(screen.getByText('Centre d’aide / FAQ')).toBeInTheDocument()
    expect(screen.getByText('Retour d’expérience')).toBeInTheDocument()
    expect(screen.getByText('Version de l’app')).toBeInTheDocument()
  })
})
