import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DEFAULT_QUOTES_SETTINGS } from './quotes-settings'
import { useQuotesSettings } from './quotes-settings-context'
import { QuotesSettingsProvider } from './QuotesSettingsProvider'

function wrapper({ children }: { children: ReactNode }) {
  return <QuotesSettingsProvider>{children}</QuotesSettingsProvider>
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('QuotesSettingsProvider — persistance locale des réglages de citations', () => {
  it('démarre avec les valeurs par défaut quand rien n’est stocké', () => {
    const { result } = renderHook(() => useQuotesSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_QUOTES_SETTINGS)
  })

  it('persiste un changement dans le stockage local et le relit au prochain montage', () => {
    const { result, unmount } = renderHook(() => useQuotesSettings(), { wrapper })

    act(() => {
      result.current.setSettings({
        showOnHome: false,
        showOnFocus: true,
        rotation: 'everyLoad',
        category: 'medicine',
      })
    })
    expect(result.current.settings.showOnFocus).toBe(true)
    unmount()

    const { result: second } = renderHook(() => useQuotesSettings(), { wrapper })
    expect(second.current.settings.showOnFocus).toBe(true)
    expect(second.current.settings.showOnHome).toBe(false)
    expect(second.current.settings.category).toBe('medicine')
  })

  it('ignore une valeur corrompue et retombe sur les valeurs par défaut', () => {
    window.localStorage.setItem('flowquest.quotesSettings', JSON.stringify({ rotation: 'never' }))
    const { result } = renderHook(() => useQuotesSettings(), { wrapper })
    expect(result.current.settings).toEqual(DEFAULT_QUOTES_SETTINGS)
  })
})
