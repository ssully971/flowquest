import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useAuthMock = vi.fn()
const useGlobalTimerStateMock = vi.fn()
const upsertLiveStatusMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => useAuthMock() }))
vi.mock('@/features/timer/useGlobalTimerState', () => ({
  useGlobalTimerState: () => useGlobalTimerStateMock(),
}))
vi.mock('./live-status-repository', () => ({
  upsertLiveStatus: (...args: unknown[]) => upsertLiveStatusMock(...args),
}))

const USER = { id: 'user-1' }

beforeEach(() => {
  useAuthMock.mockReturnValue({ status: 'authenticated', user: USER })
  useGlobalTimerStateMock.mockReturnValue({ liveState: 'inactive', startedAt: null, durationMs: null })
  upsertLiveStatusMock.mockReset().mockResolvedValue(undefined)
})

describe('useLiveStatusSync — battement de cœur du statut en direct (LOT F2)', () => {
  it('pousse le statut au premier rendu (authentifié)', async () => {
    const { useLiveStatusSync } = await import('./useLiveStatusSync')
    renderHook(() => useLiveStatusSync())

    expect(upsertLiveStatusMock).toHaveBeenCalledWith('user-1', 'inactive', null, null)
  })

  it('ne pousse rien en mode invité', async () => {
    useAuthMock.mockReturnValue({ status: 'guest', user: null })
    const { useLiveStatusSync } = await import('./useLiveStatusSync')
    renderHook(() => useLiveStatusSync())

    expect(upsertLiveStatusMock).not.toHaveBeenCalled()
  })

  it('pousse à nouveau quand l’état dérivé change (focus démarré)', async () => {
    const { useLiveStatusSync } = await import('./useLiveStatusSync')
    const { rerender } = renderHook(() => useLiveStatusSync())
    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(1)

    useGlobalTimerStateMock.mockReturnValue({ liveState: 'focus', startedAt: 1000, durationMs: 1500000 })
    rerender()

    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(2)
    expect(upsertLiveStatusMock).toHaveBeenLastCalledWith('user-1', 'focus', 1000, 1500000)
  })

  it('ne pousse pas deux fois de suite pour le même état (pas de changement, pas de battement dû)', async () => {
    const { useLiveStatusSync } = await import('./useLiveStatusSync')
    const { rerender } = renderHook(() => useLiveStatusSync())
    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(1)

    // Même objet de valeurs (mais nouvelle référence, comme le ferait un nouveau sondage
    // de useGlobalTimerState) : pas de changement détecté, pas de nouveau push immédiat.
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'inactive', startedAt: null, durationMs: null })
    rerender()

    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(1)
  })

  it('repousse quand même après 60 s, même sans changement (battement de cœur)', async () => {
    // useGlobalTimerState sonde toutes les 15 s et renvoie un nouvel objet à chaque
    // sondage, même si les valeurs n'ont pas changé (voir son propre test) : c'est ce qui
    // redéclenche cet effet régulièrement. On simule ici un nouveau sondage à valeurs
    // identiques, après 61 s d'horloge réelle.
    vi.useFakeTimers()
    const { useLiveStatusSync } = await import('./useLiveStatusSync')
    const { rerender } = renderHook(() => useLiveStatusSync())
    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(61_000)
    useGlobalTimerStateMock.mockReturnValue({ liveState: 'inactive', startedAt: null, durationMs: null })
    rerender()

    expect(upsertLiveStatusMock).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
