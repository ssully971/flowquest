import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ClockSettingsProvider } from './ClockSettingsProvider'
import { useClockSettings } from './clock-settings-context'
import { DEFAULT_CLOCK_SETTINGS } from './clock-settings'

function wrapper({ children }: { children: ReactNode }) {
  return <ClockSettingsProvider>{children}</ClockSettingsProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('ClockSettingsProvider — persistance locale des réglages de l’horloge', () => {
  it('démarre avec les valeurs par défaut quand rien n’est stocké', () => {
    const { result } = renderHook(() => useClockSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_CLOCK_SETTINGS)
  })

  it('persiste un changement dans le stockage local et le relit au prochain montage', () => {
    const { result, unmount } = renderHook(() => useClockSettings(), { wrapper })

    act(() => {
      result.current.setSettings({
        ...DEFAULT_CLOCK_SETTINGS,
        format: '12h',
        style: 'digital',
        showSeconds: true,
      })
    })
    expect(result.current.settings.format).toBe('12h')
    expect(result.current.settings.style).toBe('digital')
    unmount()

    const { result: second } = renderHook(() => useClockSettings(), { wrapper })
    expect(second.current.settings.format).toBe('12h')
    expect(second.current.settings.style).toBe('digital')
    expect(second.current.settings.showSeconds).toBe(true)
  })

  it('ignore une valeur corrompue (style inconnu) et retombe sur les valeurs par défaut', () => {
    window.localStorage.setItem(
      'flowquest.clockSettings',
      JSON.stringify({ ...DEFAULT_CLOCK_SETTINGS, style: 'inexistant' }),
    )
    const { result } = renderHook(() => useClockSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_CLOCK_SETTINGS)
  })

  it('accepte les tailles XS et S (LOT H2, §2) comme des valeurs valides, persistées', () => {
    const { result, unmount } = renderHook(() => useClockSettings(), { wrapper })

    act(() => {
      result.current.setSettings({ ...DEFAULT_CLOCK_SETTINGS, size: 'xs' })
    })
    expect(result.current.settings.size).toBe('xs')
    unmount()

    const { result: second } = renderHook(() => useClockSettings(), { wrapper })
    expect(second.current.settings.size).toBe('xs')
  })
})
