import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

const upsertMock = vi.fn()
const selectMaybeSingleMock = vi.fn()
const useAuthMock = vi.fn()

vi.mock('@/features/auth/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

vi.mock('@/shared/supabase/client', () => ({
  supabase: {
    from: () => ({
      upsert: upsertMock,
      select: () => ({ eq: () => ({ maybeSingle: selectMaybeSingleMock }) }),
    }),
  },
}))

async function clearNotes() {
  const db = await getDb()
  await db.delete('notes', 'current')
  const queueKeys = await db.getAllKeys('syncQueue')
  await Promise.all(queueKeys.map((key) => db.delete('syncQueue', key)))
}

describe('useNote — note locale d’abord, autosauvegarde différée, synchro si connecté', () => {
  beforeEach(async () => {
    upsertMock.mockReset()
    selectMaybeSingleMock.mockReset()
    upsertMock.mockResolvedValue({ error: null })
    selectMaybeSingleMock.mockResolvedValue({ data: null, error: null })
    useAuthMock.mockReturnValue({ status: 'guest', user: null })
    await clearNotes()
  })

  it('enregistre le contenu localement après une courte pause de frappe, jamais à la frappe', async () => {
    const { useNote } = await import('./useNote')
    const { result } = renderHook(() => useNote())

    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => {
      result.current.setContent('Idée de session')
    })
    expect(result.current.content).toBe('Idée de session')
    expect(result.current.isSaving).toBe(true)

    await waitFor(() => expect(result.current.isSaving).toBe(false), { timeout: 2000 })

    const { IndexedDbNoteRepository } = await import('./storage/indexed-db-note-repository')
    const stored = await new IndexedDbNoteRepository().load()
    expect(stored?.content).toBe('Idée de session')
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('ne synchronise pas vers Supabase en mode invité', async () => {
    const { useNote } = await import('./useNote')
    const { result } = renderHook(() => useNote())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => {
      result.current.setContent('Note privée invité')
    })

    await waitFor(() => expect(result.current.isSaving).toBe(false), { timeout: 2000 })
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('synchronise vers Supabase quand connecté', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'user-1' } })
    const { useNote } = await import('./useNote')
    const { result } = renderHook(() => useNote())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    act(() => {
      result.current.setContent('Note synchronisée')
    })

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1), { timeout: 2000 })
    expect(upsertMock.mock.calls[0][0].user_id).toBe('user-1')
    expect(upsertMock.mock.calls[0][0].content).toBe('Note synchronisée')
  })

  it('à la connexion, applique la version distante seulement si elle est plus récente', async () => {
    const { IndexedDbNoteRepository } = await import('./storage/indexed-db-note-repository')
    await new IndexedDbNoteRepository().save('Version locale', 1_000)

    selectMaybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        content: 'Version distante plus récente',
        updated_at: new Date(2_000).toISOString(),
      },
      error: null,
    })
    useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'user-1' } })

    const { useNote } = await import('./useNote')
    const { result } = renderHook(() => useNote())

    await waitFor(() => expect(result.current.content).toBe('Version distante plus récente'))
  })

  it('à la connexion, garde la version locale si elle est au moins aussi récente', async () => {
    const { IndexedDbNoteRepository } = await import('./storage/indexed-db-note-repository')
    await new IndexedDbNoteRepository().save('Version locale plus récente', 5_000)

    selectMaybeSingleMock.mockResolvedValue({
      data: {
        user_id: 'user-1',
        content: 'Version distante plus ancienne',
        updated_at: new Date(1_000).toISOString(),
      },
      error: null,
    })
    useAuthMock.mockReturnValue({ status: 'authenticated', user: { id: 'user-1' } })

    const { useNote } = await import('./useNote')
    const { result } = renderHook(() => useNote())
    await waitFor(() => expect(result.current.isLoaded).toBe(true))

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    expect(result.current.content).toBe('Version locale plus récente')
  })
})
