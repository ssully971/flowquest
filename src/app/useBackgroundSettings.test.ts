import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/shared/design-system'

import { useBackgroundSettings } from './useBackgroundSettings'

function renderWithTheme(appearance: 'dark' | 'light') {
  window.localStorage.setItem('flowquest.appearance', appearance)
  return renderHook(() => useBackgroundSettings(), { wrapper: ThemeProvider })
}

describe('useBackgroundSettings — mode Ambiant sur un paysage par défaut (lot 3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('le mode Ambiant démarre sur un fond de catégorie paysage (scenic), pas le dégradé par défaut des autres modes', () => {
    const { result } = renderWithTheme('dark')
    expect(result.current.selection.ambient).toBe('photo-fjord')
  })

  it('un choix explicite est conservé et persiste', () => {
    const { result } = renderWithTheme('dark')
    act(() => result.current.setBackground('ambient', 'photo-torrent'))
    expect(result.current.selection.ambient).toBe('photo-torrent')

    const { result: freshResult } = renderWithTheme('dark')
    expect(freshResult.current.selection.ambient).toBe('photo-torrent')
  })
})

describe('useBackgroundSettings — fond par défaut selon le thème pour un nouveau visiteur (LOT B)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('Aurore pour un nouveau visiteur en thème sombre', () => {
    const { result } = renderWithTheme('dark')
    expect(result.current.selection.home).toBe('photo-aurore')
    expect(result.current.selection.focus).toBe('photo-aurore')
  })

  it('Lueur pour un nouveau visiteur en thème clair', () => {
    const { result } = renderWithTheme('light')
    expect(result.current.selection.home).toBe('photo-lueur')
    expect(result.current.selection.focus).toBe('photo-lueur')
  })

  it('ne change jamais un choix déjà fait, même égal à l’ancien défaut « Horizon »', () => {
    window.localStorage.setItem(
      'flowquest.backgrounds',
      JSON.stringify({ home: 'horizon', focus: 'horizon', ambient: 'photo-fjord' }),
    )
    const { result } = renderWithTheme('dark')

    expect(result.current.selection.home).toBe('horizon')
    expect(result.current.selection.focus).toBe('horizon')
  })
})
