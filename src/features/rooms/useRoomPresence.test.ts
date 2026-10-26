import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const touchMock = vi.fn()
vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: true, supabase: {} }))
vi.mock('./rooms-repository', () => ({ touchMyRooms: () => touchMock() }))

import { useRoomPresence } from './useRoomPresence'

describe('useRoomPresence — battement de cœur global des salons (LOT M1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    touchMock.mockReset()
    touchMock.mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ne fait rien sans salon actif', () => {
    renderHook(() => useRoomPresence(false))
    act(() => void vi.advanceTimersByTime(120_000))
    expect(touchMock).not.toHaveBeenCalled()
  })

  it('signale la présence tout de suite puis toutes les 30 s', () => {
    renderHook(() => useRoomPresence(true))
    expect(touchMock).toHaveBeenCalledTimes(1)
    act(() => void vi.advanceTimersByTime(60_000))
    expect(touchMock).toHaveBeenCalledTimes(3)
  })

  it('signale aussi la présence au retour au premier plan et au retour réseau', () => {
    renderHook(() => useRoomPresence(true))
    touchMock.mockClear()
    act(() => void document.dispatchEvent(new Event('visibilitychange')))
    act(() => void window.dispatchEvent(new Event('online')))
    expect(touchMock).toHaveBeenCalledTimes(2)
  })

  it('s’arrête au démontage (ni quitter ni terminer le salon : rien d’autre n’est appelé)', () => {
    const { unmount } = renderHook(() => useRoomPresence(true))
    unmount()
    touchMock.mockClear()
    act(() => void vi.advanceTimersByTime(120_000))
    expect(touchMock).not.toHaveBeenCalled()
  })
})
