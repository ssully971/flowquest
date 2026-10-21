import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { clearAllLocalStorage } from './clear-local-storage'
import { DiagnosticPage } from './DiagnosticPage'

vi.mock('./clear-local-storage', () => ({ clearAllLocalStorage: vi.fn().mockResolvedValue(undefined) }))

function renderDiagnosticPage() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <DiagnosticPage />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('DiagnosticPage — mode invité (aucune variable Supabase définie dans les tests)', () => {
  it('affiche le message « non configuré » et les variables comme absentes', () => {
    renderDiagnosticPage()

    expect(
      screen.getByText(
        'VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont absentes : l’app fonctionne entièrement en mode invité (stockage local), aucune autre vérification n’est possible ici.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('VITE_SUPABASE_URL')).toBeInTheDocument()
    expect(screen.getAllByText('absente').length).toBeGreaterThan(0)
  })

  it('ne tente aucune vérification réseau quand Supabase n’est pas configuré', () => {
    renderDiagnosticPage()

    expect(screen.queryByText('Format de l’URL Supabase')).not.toBeInTheDocument()
    expect(screen.queryByText('Lecture des tables principales')).not.toBeInTheDocument()
  })

  it('propose un lien de retour à l’accueil', () => {
    renderDiagnosticPage()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })
})

describe('DiagnosticPage — vider le stockage local, dernier recours (LOT E9)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(clearAllLocalStorage).mockClear()
  })

  it('ne vide rien si la confirmation est refusée', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderDiagnosticPage()

    await user.click(screen.getByRole('button', { name: 'Vider le stockage de cet appareil' }))

    expect(window.confirm).toHaveBeenCalled()
    expect(clearAllLocalStorage).not.toHaveBeenCalled()
  })

  it('vide le stockage et recharge la page une fois la confirmation acceptée', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadMock },
      writable: true,
    })
    renderDiagnosticPage()

    await user.click(screen.getByRole('button', { name: 'Vider le stockage de cet appareil' }))

    expect(clearAllLocalStorage).toHaveBeenCalled()
    await screen.findByRole('button', { name: 'Suppression en cours…' })
    await vi.waitFor(() => expect(reloadMock).toHaveBeenCalled())
  })
})
