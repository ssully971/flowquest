import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_EXTRAS_SETTINGS } from './extras-settings'
import { useExtrasSettings } from './extras-settings-context'
import { ExtrasSettingsProvider } from './ExtrasSettingsProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <ExtrasSettingsProvider>{children}</ExtrasSettingsProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ExtrasSettingsProvider — persistance locale des réglages Extras', () => {
  it('démarre avec les valeurs par défaut quand rien n’est stocké', () => {
    const { result } = renderHook(() => useExtrasSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_EXTRAS_SETTINGS)
  })

  it('persiste un changement dans le stockage local et le relit au prochain montage', () => {
    const { result, unmount } = renderHook(() => useExtrasSettings(), { wrapper })

    act(() => {
      result.current.setSettings({
        ...DEFAULT_EXTRAS_SETTINGS,
        displayName: 'Camille',
        preventSleep: true,
        defaultSettingsTab: 'stats',
      })
    })
    expect(result.current.settings.displayName).toBe('Camille')
    unmount()

    const { result: second } = renderHook(() => useExtrasSettings(), { wrapper })
    expect(second.current.settings.displayName).toBe('Camille')
    expect(second.current.settings.preventSleep).toBe(true)
    expect(second.current.settings.defaultSettingsTab).toBe('stats')
  })

  it('ignore une valeur corrompue (onglet par défaut inconnu) et retombe sur les valeurs par défaut', () => {
    window.localStorage.setItem(
      'flowquest.extrasSettings',
      JSON.stringify({ ...DEFAULT_EXTRAS_SETTINGS, defaultSettingsTab: 'inexistant' }),
    )
    const { result } = renderHook(() => useExtrasSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_EXTRAS_SETTINGS)
  })
})
