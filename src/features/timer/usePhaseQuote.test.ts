import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePhaseQuote } from './usePhaseQuote'

const POOL = [
  { text: 'Un', author: 'A', category: 'focus' as const },
  { text: 'Deux', author: 'B', category: 'focus' as const },
]

beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('usePhaseQuote — LOT G1', () => {
  it('renvoie une citation dès le montage (au chargement)', () => {
    const { result } = renderHook(() => usePhaseQuote('all', POOL, null))
    expect(result.current).toEqual(POOL[0])
  })

  it('ne change pas tant que phaseKey reste null (aucune phase démarrée)', () => {
    const { result, rerender } = renderHook(({ key }: { key: string | null }) => usePhaseQuote('all', POOL, key), {
      initialProps: { key: null },
    })
    const first = result.current
    rerender({ key: null })
    expect(result.current).toBe(first)
  })

  it('change de citation quand phaseKey change (nouveau début de phase)', () => {
    const { result, rerender } = renderHook(({ key }: { key: string | null }) => usePhaseQuote('all', POOL, key), {
      initialProps: { key: 'focus:1000' },
    })
    expect(result.current).toEqual(POOL[0])

    // Math.random() renvoie toujours 0 : sans l'exclusion de la citation précédente, on
    // retomberait systématiquement sur la même — la nouvelle doit donc être « Deux ».
    rerender({ key: 'focus:2000' })
    expect(result.current).toEqual(POOL[1])
  })

  it('ne change pas si phaseKey reste identique (simple re-rendu, pause/reprise)', () => {
    const { result, rerender } = renderHook(({ key }: { key: string | null }) => usePhaseQuote('all', POOL, key), {
      initialProps: { key: 'focus:1000' },
    })
    const first = result.current
    rerender({ key: 'focus:1000' })
    expect(result.current).toBe(first)
  })
})
