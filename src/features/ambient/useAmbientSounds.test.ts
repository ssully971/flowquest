import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAmbientSounds } from './useAmbientSounds'

describe('useAmbientSounds — moteur des sons d’ambiance (§12/§17/§18 du cahier des charges)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('démarre sans aucun son actif, avec de la place pour en activer', () => {
    const { result } = renderHook(() => useAmbientSounds())
    expect(result.current.activeIds).toEqual([])
    expect(result.current.canActivateMore).toBe(true)
  })

  it('active un son au premier basculement, le désactive au second', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    expect(result.current.activeIds).toEqual(['rain'])

    act(() => result.current.toggle('rain'))
    expect(result.current.activeIds).toEqual([])
  })

  it('refuse un troisième son simultané (deux sons maximum)', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    act(() => result.current.toggle('waves'))
    expect(result.current.canActivateMore).toBe(false)

    act(() => result.current.toggle('forest'))
    expect(result.current.activeIds).toEqual(['rain', 'waves'])
  })

  it('mémorise le volume réglé pour un son', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.setVolume('rain', 0.2))
    expect(result.current.volumes.rain).toBe(0.2)
  })

  it('arrête tous les sons quand le minuteur d’arrêt expire', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.toggle('rain'))
    act(() => result.current.setSleepTimerMinutes(15))
    expect(result.current.remainingSleepMs).toBe(15 * 60_000)

    act(() => {
      vi.advanceTimersByTime(15 * 60_000 + 1000)
    })

    expect(result.current.activeIds).toEqual([])
    expect(result.current.sleepTimerMinutes).toBeNull()
    expect(result.current.remainingSleepMs).toBeNull()
  })

  it('annule le minuteur d’arrêt si on le remet à « Aucun »', () => {
    const { result } = renderHook(() => useAmbientSounds())

    act(() => result.current.setSleepTimerMinutes(15))
    act(() => result.current.setSleepTimerMinutes(null))

    expect(result.current.sleepTimerMinutes).toBeNull()
    expect(result.current.remainingSleepMs).toBeNull()
  })
})
