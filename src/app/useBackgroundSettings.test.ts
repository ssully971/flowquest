import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useBackgroundSettings } from './useBackgroundSettings'

describe('useBackgroundSettings — mode Ambiant sur un paysage par défaut (lot 3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('le mode Ambiant démarre sur un fond de catégorie paysage (scenic), pas le dégradé par défaut des autres modes', () => {
    const { result } = renderHook(() => useBackgroundSettings())
    expect(result.current.selection.ambient).toBe('photo-fjord')
    expect(result.current.selection.home).toBe('horizon')
    expect(result.current.selection.focus).toBe('horizon')
  })

  it('un choix explicite est conservé et persiste', () => {
    const { result, rerender } = renderHook(() => useBackgroundSettings())
    act(() => result.current.setBackground('ambient', 'photo-torrent'))
    expect(result.current.selection.ambient).toBe('photo-torrent')

    rerender()
    const { result: freshResult } = renderHook(() => useBackgroundSettings())
    expect(freshResult.current.selection.ambient).toBe('photo-torrent')
  })
})
