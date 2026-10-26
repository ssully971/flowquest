import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLiveTabTitle } from './useLiveTabTitle'

describe('useLiveTabTitle — titre d’onglet live pendant une session (lot 4)', () => {
  it('affiche "(MM:SS) Fokitsu" quand actif', () => {
    renderHook(() => useLiveTabTitle('24:59', true))
    expect(document.title).toBe('(24:59) Fokitsu')
  })

  it('laisse le titre normal quand inactif', () => {
    renderHook(() => useLiveTabTitle('24:59', false))
    expect(document.title).toBe('Fokitsu')
  })

  it('met à jour le titre quand le temps affiché change', () => {
    const { rerender } = renderHook(({ label }) => useLiveTabTitle(label, true), {
      initialProps: { label: '24:59' },
    })
    expect(document.title).toBe('(24:59) Fokitsu')

    rerender({ label: '24:58' })
    expect(document.title).toBe('(24:58) Fokitsu')
  })

  it('restaure le titre normal au démontage (quitte l’écran Focus en cours de session)', () => {
    const { unmount } = renderHook(() => useLiveTabTitle('10:00', true))
    expect(document.title).toBe('(10:00) Fokitsu')

    unmount()
    expect(document.title).toBe('Fokitsu')
  })
})
