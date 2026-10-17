import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { BackgroundDisplaySettingsProvider } from './BackgroundDisplaySettingsProvider'
import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from './background-display-settings'
import { useBackgroundDisplaySettings } from './background-display-settings-context'

function wrapper({ children }: { children: ReactNode }) {
  return <BackgroundDisplaySettingsProvider>{children}</BackgroundDisplaySettingsProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('BackgroundDisplaySettingsProvider — flou du fond mémorisé (lot 3)', () => {
  it('démarre à 0% (net) quand rien n’est stocké', () => {
    const { result } = renderHook(() => useBackgroundDisplaySettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_BACKGROUND_DISPLAY_SETTINGS)
  })

  it('persiste un changement et le relit au prochain montage', () => {
    const { result, unmount } = renderHook(() => useBackgroundDisplaySettings(), { wrapper })

    act(() => result.current.setSettings({ blurPercent: 40 }))
    expect(result.current.settings.blurPercent).toBe(40)

    unmount()
    const { result: reloaded } = renderHook(() => useBackgroundDisplaySettings(), { wrapper })
    expect(reloaded.current.settings.blurPercent).toBe(40)
  })

  it('ignore une valeur stockée hors de la plage 0-100', () => {
    window.localStorage.setItem('flowquest.backgroundDisplaySettings', JSON.stringify({ blurPercent: 150 }))
    const { result } = renderHook(() => useBackgroundDisplaySettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_BACKGROUND_DISPLAY_SETTINGS)
  })
})
