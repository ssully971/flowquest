import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { TimerSettingsProvider } from './TimerSettingsProvider'
import { DEFAULT_TIMER_SETTINGS } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'

function wrapper({ children }: { children: ReactNode }) {
  return <TimerSettingsProvider>{children}</TimerSettingsProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('TimerSettingsProvider — persistance locale des réglages du minuteur', () => {
  it('démarre avec les valeurs par défaut quand rien n’est stocké', () => {
    const { result } = renderHook(() => useTimerSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_TIMER_SETTINGS)
  })

  it('persiste un changement dans le stockage local et le relit au prochain montage', () => {
    const { result, unmount } = renderHook(() => useTimerSettings(), { wrapper })

    act(() => {
      result.current.setSettings({
        ...DEFAULT_TIMER_SETTINGS,
        focusMinutes: 50,
        autoStartNext: true,
      })
    })
    expect(result.current.settings.focusMinutes).toBe(50)
    expect(result.current.settings.autoStartNext).toBe(true)
    unmount()

    const { result: second } = renderHook(() => useTimerSettings(), { wrapper })
    expect(second.current.settings.focusMinutes).toBe(50)
    expect(second.current.settings.autoStartNext).toBe(true)
  })

  it('ignore une valeur corrompue dans le stockage local et retombe sur les valeurs par défaut', () => {
    window.localStorage.setItem('flowquest.timerSettings', '{"not":"valid"}')
    const { result } = renderHook(() => useTimerSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_TIMER_SETTINGS)
  })
})
