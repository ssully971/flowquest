import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { AuthStatus } from '@/features/auth/auth-context'

import { AuthStub } from './AuthStub'
import { UpsellContext } from './upsell-context'
import { useFeatureAccess } from './useFeatureAccess'

function setup(status: AuthStatus, configured = true) {
  const openUpsell = vi.fn()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthStub status={status} configured={configured}>
      <UpsellContext.Provider
        value={{ isOpen: false, feature: null, openUpsell, closeUpsell: vi.fn() }}
      >
        {children}
      </UpsellContext.Provider>
    </AuthStub>
  )
  const { result, rerender } = renderHook(() => useFeatureAccess(), { wrapper })
  return { result, openUpsell, rerender }
}

describe('useFeatureAccess', () => {
  it('invité : verrouille les quatre fonctions et requireAccount ouvre la modale', () => {
    const { result, openUpsell } = setup('guest')

    for (const feature of ['stats', 'tasks', 'ambientSounds', 'deepFocus'] as const) {
      expect(result.current.isLocked(feature)).toBe(true)
    }
    expect(result.current.requireAccount('tasks')).toBe(false)
    expect(openUpsell).toHaveBeenCalledWith('tasks')
  })

  it('connecté : rien n’est verrouillé et la modale ne s’ouvre pas', () => {
    const { result, openUpsell } = setup('authenticated')

    expect(result.current.isLocked('stats')).toBe(false)
    expect(result.current.requireAccount('stats')).toBe(true)
    expect(openUpsell).not.toHaveBeenCalled()
  })

  it('chargement : ni cadenas ni modale', () => {
    const { result, openUpsell } = setup('loading')

    expect(result.current.isLocked('deepFocus')).toBe(false)
    expect(result.current.requireAccount('deepFocus')).toBe(true)
    expect(openUpsell).not.toHaveBeenCalled()
  })

  it('Supabase non configuré : rien n’est verrouillé même en invité', () => {
    const { result, openUpsell } = setup('guest', false)

    expect(result.current.isLocked('ambientSounds')).toBe(false)
    expect(result.current.requireAccount('ambientSounds')).toBe(true)
    expect(openUpsell).not.toHaveBeenCalled()
  })

  it('sans AuthProvider (composant monté isolément) : rien n’est verrouillé', () => {
    const { result } = renderHook(() => useFeatureAccess())
    expect(result.current.isLocked('stats')).toBe(false)
  })
})
