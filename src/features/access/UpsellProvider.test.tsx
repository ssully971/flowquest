import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthGate } from '@/features/auth/AuthGate'
import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import { ToastProvider } from '@/shared/toast'

import { AuthStub } from './AuthStub'
import { useFeatureAccess } from './useFeatureAccess'

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

function Feature() {
  const { requireAccount } = useFeatureAccess()
  return (
    <button type="button" onClick={() => requireAccount('tasks')}>
      Ouvrir Tâches
    </button>
  )
}

function renderApp() {
  window.sessionStorage.setItem('flowquest.authGateDismissed', 'true')
  return render(
    <ToastProvider>
      <AuthStub>
        <AuthGateRequestProvider>
          <AuthGate>
            <Feature />
          </AuthGate>
        </AuthGateRequestProvider>
      </AuthStub>
    </ToastProvider>,
  )
}

describe('UpsellProvider — modale unique et ouverture de AuthGate', () => {
  it('ouvre la modale au clic, puis « Plus tard » la ferme et rend le focus au déclencheur', async () => {
    const user = userEvent.setup()
    renderApp()

    const trigger = screen.getByRole('button', { name: 'Ouvrir Tâches' })
    await user.click(trigger)
    expect(screen.getByRole('dialog', { name: /Débloque/ })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Plus tard' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await vi.waitFor(() => expect(trigger).toHaveFocus())
  })

  it('« S’inscrire » ferme la modale et ouvre AuthGate sur le formulaire d’inscription', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Ouvrir Tâches' }))
    await user.click(screen.getByRole('button', { name: 'S’inscrire (J’ai un code)' }))

    expect(screen.queryByRole('dialog', { name: /Débloque/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pseudo')).toBeInTheDocument()
  })

  it('« Se connecter » ouvre AuthGate sur la connexion', async () => {
    const user = userEvent.setup()
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Ouvrir Tâches' }))
    await user.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(screen.queryByLabelText('Pseudo')).not.toBeInTheDocument()
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument()
  })
})
