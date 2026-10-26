import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AdminGameMasterPanel } from './AdminGameMasterPanel'

const useFeatureFlagMock = vi.fn()
const rpcMock = vi.fn()

vi.mock('@/features/feature-flags/useFeatureFlag', () => ({
  useFeatureFlag: () => useFeatureFlagMock(),
}))

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

function renderPanel() {
  return render(
    <ToastProvider>
      <AdminGameMasterPanel />
    </ToastProvider>,
  )
}

beforeEach(() => {
  rpcMock.mockReset()
  useFeatureFlagMock.mockReturnValue(true)
  rpcMock.mockImplementation((name: string) => {
    if (name === 'admin_list_campaigns') return Promise.resolve({ data: [], error: null })
    if (name === 'admin_list_users') return Promise.resolve({ data: [], error: null })
    return Promise.resolve({ data: null, error: null })
  })
})

describe('AdminGameMasterPanel — Maître du jeu (lot I3, §6)', () => {
  it('affiche « aucune campagne active » au départ', async () => {
    renderPanel()
    expect(await screen.findByText('Aucune campagne active.')).toBeInTheDocument()
  })

  it('démarre le week-end Double XP au clic', async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === 'admin_list_campaigns') return Promise.resolve({ data: [], error: null })
      if (name === 'admin_start_campaign')
        return Promise.resolve({
          data: { id: 'c1', name: 'Week-end Double XP', xp_multiplier: 2, active: true },
          error: null,
        })
      return Promise.resolve({ data: null, error: null })
    })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Aucune campagne active.')

    await user.click(screen.getByRole('button', { name: /Activer le week-end Double XP/ }))

    expect(rpcMock).toHaveBeenCalledWith(
      'admin_start_campaign',
      expect.objectContaining({ p_name: 'Week-end Double XP', p_xp_multiplier: 2 }),
    )
  })

  it('affiche un avertissement et grise les contrôles quand le drapeau « pillars » est désactivé', async () => {
    useFeatureFlagMock.mockReturnValue(false)
    renderPanel()
    expect(await screen.findByText(/piliers de vie sont désactivés/)).toBeInTheDocument()
  })

  it('sélectionne un utilisateur puis affiche ses piliers pour offrir de l’XP', async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === 'admin_list_campaigns') return Promise.resolve({ data: [], error: null })
      if (name === 'admin_list_users')
        return Promise.resolve({
          data: [{ id: 'u1', username: 'alice', email: 'alice@exemple.com' }],
          error: null,
        })
      if (name === 'admin_list_user_pillars')
        return Promise.resolve({ data: [{ id: 'p1', name: 'Travail' }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Aucune campagne active.')

    await user.type(screen.getAllByPlaceholderText('Chercher par pseudo ou e-mail…')[0], 'ali')
    await user.click(await screen.findByText('alice'))

    expect(await screen.findByText('Travail')).toBeInTheDocument()
  })

  it('le bouton Offrir reste désactivé sans pilier ni motif', async () => {
    rpcMock.mockImplementation((name: string) => {
      if (name === 'admin_list_campaigns') return Promise.resolve({ data: [], error: null })
      if (name === 'admin_list_users')
        return Promise.resolve({
          data: [{ id: 'u1', username: 'alice', email: 'alice@exemple.com' }],
          error: null,
        })
      if (name === 'admin_list_user_pillars')
        return Promise.resolve({ data: [{ id: 'p1', name: 'Travail' }], error: null })
      return Promise.resolve({ data: null, error: null })
    })
    const user = userEvent.setup()
    renderPanel()
    await screen.findByText('Aucune campagne active.')
    await user.type(screen.getAllByPlaceholderText('Chercher par pseudo ou e-mail…')[0], 'ali')
    await user.click(await screen.findByText('alice'))
    await screen.findByText('Travail')

    expect(screen.getByRole('button', { name: 'Offrir' })).toBeDisabled()
  })
})
