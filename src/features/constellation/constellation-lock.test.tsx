import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthStub } from '@/features/access/AuthStub'
import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import { PillarsPage } from '@/features/settings/pages/PillarsPage'
import { ToastProvider } from '@/shared/toast'

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({ useFeatureFlag: () => true }))
// Des comptes existent sur ce déploiement : un invité est donc verrouillé (docs/MODE_INVITE.md).
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: true, supabase: null }))

function renderPage(status: 'guest' | 'authenticated') {
  return render(
    <ToastProvider>
      <AuthStub status={status}>
        <AuthGateRequestProvider>
          <PillarsPage />
        </AuthGateRequestProvider>
      </AuthStub>
    </ToastProvider>,
  )
}

describe('Constellation — verrouillée pour les invités', () => {
  it('invité : cadenas à la place du bouton, la page n’est jamais montée', async () => {
    window.sessionStorage.setItem('flowquest.authGateDismissed', 'true')
    renderPage('guest')

    expect(
      await screen.findByRole('button', {
        name: 'Constellation, verrouillé : crée un compte pour débloquer',
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Ouvrir la constellation' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('constellation-page')).not.toBeInTheDocument()
  })

  it('compte connecté : le bouton ouvre la page, qui se ferme', async () => {
    const user = userEvent.setup()
    renderPage('authenticated')

    await user.click(await screen.findByRole('button', { name: 'Ouvrir la constellation' }))
    expect(await screen.findByTestId('constellation-page')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Fermer la constellation' }))
    expect(screen.queryByTestId('constellation-page')).not.toBeInTheDocument()
  })
})
