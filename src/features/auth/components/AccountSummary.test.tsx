import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ToastProvider } from '@/shared/toast'

import { AuthProvider } from '../AuthProvider'
import { AccountSummary } from './AccountSummary'

const updateMock = vi.fn()

let currentProfile = {
  id: 'user-1',
  username: 'sullivan',
  display_name: null as string | null,
  avatar_url: null as string | null,
  role: 'user',
  timezone: 'Europe/Paris',
  stats_visibility: 'public',
  avatar_version: 0,
  marketing_consent: false,
  marketing_consent_at: null as string | null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { user: { id: 'user-1', email: 'sullivan@exemple.com' } } },
        }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: () => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
    from: () => ({
      select: () => ({
        eq: () => ({ single: () => Promise.resolve({ data: currentProfile, error: null }) }),
      }),
      update: (patch: Record<string, unknown>) => ({
        eq: () => ({
          select: () => ({
            single: () => {
              updateMock(patch)
              currentProfile = { ...currentProfile, ...patch }
              return Promise.resolve({ data: currentProfile, error: null })
            },
          }),
        }),
      }),
    }),
    rpc: vi.fn(),
  },
}))

function renderSummary() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <AccountSummary />
      </AuthProvider>
    </ToastProvider>,
  )
}

beforeEach(() => {
  updateMock.mockReset()
  currentProfile = {
    id: 'user-1',
    username: 'sullivan',
    display_name: null,
    avatar_url: null,
    role: 'user',
    timezone: 'Europe/Paris',
    stats_visibility: 'public',
    avatar_version: 0,
    marketing_consent: false,
    marketing_consent_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  }
})

describe('AccountSummary — consentement marketing (lot I1, §3)', () => {
  it('décoché par défaut, se coche et envoie marketing_consent=true avec un horodatage', async () => {
    renderSummary()
    const toggle = await screen.findByRole('switch', {
      name: 'Recevoir les nouveautés par e-mail',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        marketing_consent: true,
        marketing_consent_at: expect.any(String),
      }),
    )
  })

  it('déjà consenti : se décoche et envoie marketing_consent=false, marketing_consent_at=null', async () => {
    currentProfile = {
      ...currentProfile,
      marketing_consent: true,
      marketing_consent_at: '2026-01-01T00:00:00.000Z',
    }
    renderSummary()
    const toggle = await screen.findByRole('switch', {
      name: 'Recevoir les nouveautés par e-mail',
    })
    expect(toggle).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(toggle)

    expect(updateMock).toHaveBeenCalledWith({
      marketing_consent: false,
      marketing_consent_at: null,
    })
  })
})
