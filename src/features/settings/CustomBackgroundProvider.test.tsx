import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { CustomBackgroundProvider } from './CustomBackgroundProvider'
import { CustomBackgroundError, processCustomBackgroundFile } from './custom-background'
import { useCustomBackground } from './custom-background-context'

vi.mock('./custom-background', async () => {
  const actual = await vi.importActual<typeof import('./custom-background')>('./custom-background')
  return { ...actual, processCustomBackgroundFile: vi.fn() }
})

function wrapper({ children }: { children: ReactNode }) {
  return <CustomBackgroundProvider>{children}</CustomBackgroundProvider>
}

beforeEach(async () => {
  const db = await getDb()
  await db.delete('customBackground', 'current')
  vi.mocked(processCustomBackgroundFile).mockReset()

  let urlCount = 0
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => `blob:fake-${urlCount++}`),
    revokeObjectURL: vi.fn(),
  })
})

describe('CustomBackgroundProvider — téléversement du fond personnel (lot 3)', () => {
  it('démarre vide quand rien n’a été envoyé', async () => {
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))
    expect(result.current.objectUrl).toBeNull()
  })

  it('upload réussi passe en "ready" et crée un object URL', async () => {
    vi.mocked(processCustomBackgroundFile).mockResolvedValue(new Blob(['x']))
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))

    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    await act(async () => {
      await result.current.upload(file)
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.objectUrl).toBe('blob:fake-0')
    expect(result.current.position).toBe('center')
  })

  it('upload échoué repasse en "empty" et relance l’erreur pour l’UI', async () => {
    vi.mocked(processCustomBackgroundFile).mockRejectedValue(
      new CustomBackgroundError('Choisis un fichier image.'),
    )
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))

    const file = new File(['x'], 'photo.pdf', { type: 'application/pdf' })
    await expect(
      act(async () => {
        await result.current.upload(file)
      }),
    ).rejects.toThrow('Choisis un fichier image.')

    expect(result.current.status).toBe('empty')
  })

  it('remove() efface le fond et repasse en "empty"', async () => {
    vi.mocked(processCustomBackgroundFile).mockResolvedValue(new Blob(['x']))
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('empty'))

    await act(async () => {
      await result.current.upload(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }))
    })
    expect(result.current.status).toBe('ready')

    await act(async () => {
      await result.current.remove()
    })
    expect(result.current.status).toBe('empty')
    expect(result.current.objectUrl).toBeNull()
  })
})
