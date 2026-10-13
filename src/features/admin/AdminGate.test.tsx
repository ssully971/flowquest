import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AdminGate } from './AdminGate'

function renderAdminGate() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AdminGate />
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AdminGate — garde de route côté interface (confort de navigation, pas la vraie barrière de sécurité)', () => {
  it('refuse l’accès en mode invité (non connecté)', () => {
    renderAdminGate()
    expect(screen.getByText('Accès réservé aux administrateurs.')).toBeInTheDocument()
  })

  it('propose un lien de retour à l’accueil quand l’accès est refusé', () => {
    renderAdminGate()
    expect(screen.getByRole('link', { name: 'Retour à l’accueil' })).toHaveAttribute('href', '/')
  })

  it('ne rend jamais le contenu admin sans un rôle admin confirmé', () => {
    renderAdminGate()
    expect(screen.queryByText(/Panneau administrateur/)).not.toBeInTheDocument()
  })
})
