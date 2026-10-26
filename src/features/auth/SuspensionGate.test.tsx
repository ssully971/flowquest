import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SuspensionGate } from './SuspensionGate'

const useAuthMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

describe('SuspensionGate — écran « compte suspendu » (lot I3, §2)', () => {
  it('affiche normalement les enfants pour un compte non suspendu', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: { suspended_until: null } })
    render(
      <SuspensionGate>
        <p>Contenu normal</p>
      </SuspensionGate>,
    )
    expect(screen.getByText('Contenu normal')).toBeInTheDocument()
  })

  it('affiche normalement les enfants pour un invité (pas de profil)', () => {
    useAuthMock.mockReturnValue({ status: 'guest', profile: null })
    render(
      <SuspensionGate>
        <p>Contenu normal</p>
      </SuspensionGate>,
    )
    expect(screen.getByText('Contenu normal')).toBeInTheDocument()
  })

  it('bloque l’app et affiche la date de fin pour un compte suspendu', () => {
    const until = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: { suspended_until: until } })
    render(
      <SuspensionGate>
        <p>Contenu normal</p>
      </SuspensionGate>,
    )
    expect(screen.queryByText('Contenu normal')).not.toBeInTheDocument()
    expect(screen.getByText('Compte suspendu')).toBeInTheDocument()
  })

  it('ne bloque plus un compte dont la suspension est déjà expirée', () => {
    const until = new Date(Date.now() - 1000).toISOString()
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: { suspended_until: until } })
    render(
      <SuspensionGate>
        <p>Contenu normal</p>
      </SuspensionGate>,
    )
    expect(screen.getByText('Contenu normal')).toBeInTheDocument()
  })
})
