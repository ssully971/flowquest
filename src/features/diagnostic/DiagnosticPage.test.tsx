import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { DiagnosticPage } from './DiagnosticPage'

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
