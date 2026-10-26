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
    expect(result.current.resolve('ambient')).toBe('photo-fjord')
  })

  it('un choix explicite est conservé et persiste', () => {
    const { result } = renderWithTheme('dark')
    act(() => result.current.setBackground('ambient', 'dark', 'photo-torrent'))
    expect(result.current.resolve('ambient')).toBe('photo-torrent')

    const { result: freshResult } = renderWithTheme('dark')
    expect(freshResult.current.resolve('ambient')).toBe('photo-torrent')
  })
})

describe('useBackgroundSettings — fond par défaut selon le thème pour un nouveau visiteur (LOT B)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('Aurore pour un nouveau visiteur en thème sombre', () => {
    const { result } = renderWithTheme('dark')
    expect(result.current.resolve('home')).toBe('photo-aurore')
    expect(result.current.resolve('focus')).toBe('photo-aurore')
  })

  it('Lueur pour un nouveau visiteur en thème clair', () => {
    const { result } = renderWithTheme('light')
    expect(result.current.resolve('home')).toBe('photo-lueur')
    expect(result.current.resolve('focus')).toBe('photo-lueur')
  })

  it('ne change jamais un choix déjà fait, même égal à l’ancien défaut « Horizon »', () => {
    window.localStorage.setItem(
      'flowquest.backgrounds',
      JSON.stringify({ home: 'horizon', focus: 'horizon', ambient: 'photo-fjord' }),
    )
    const { result } = renderWithTheme('dark')

    expect(result.current.resolve('home')).toBe('horizon')
    expect(result.current.resolve('focus')).toBe('horizon')
  })
})

describe('useBackgroundSettings — un fond par thème (lot 3 bis, §3)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('bascule automatiquement de fond quand le thème change, pour un mode non lié', () => {
    const { result } = renderWithTheme('dark')
    act(() => {
      result.current.setBackground('home', 'dark', 'photo-braise')
      result.current.setBackground('home', 'light', 'photo-azur')
    })
    expect(result.current.resolve('home')).toBe('photo-braise')
  })

  it('migre un ancien format (un seul BackgroundId par mode) : même fond dans les deux thèmes', () => {
    window.localStorage.setItem(
      'flowquest.backgrounds',
      JSON.stringify({ home: 'photo-braise', focus: 'photo-braise', ambient: 'photo-fjord' }),
    )
    const { result } = renderWithTheme('dark')
    expect(result.current.selections.home).toEqual({
      dark: 'photo-braise',
      light: 'photo-braise',
      linked: true,
    })
  })

  it('« utiliser le même fond pour les deux thèmes » aligne l’autre thème sur le thème actif', () => {
    const { result } = renderWithTheme('dark')
    act(() => {
      result.current.setBackground('home', 'dark', 'photo-braise')
      result.current.setBackground('home', 'light', 'photo-azur')
      result.current.setLinked('home', true)
    })
    expect(result.current.selections.home).toEqual({
      dark: 'photo-braise',
      light: 'photo-braise',
      linked: true,
    })
  })

  it('un mode lié applique un changement aux deux thèmes à la fois', () => {
    const { result } = renderWithTheme('dark')
    act(() => result.current.setBackground('ambient', 'dark', 'photo-torrent'))
    expect(result.current.selections.ambient).toEqual({
      dark: 'photo-torrent',
      light: 'photo-torrent',
      linked: true,
    })
  })
})
