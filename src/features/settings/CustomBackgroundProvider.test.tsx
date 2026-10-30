import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { CustomPhotoRecord } from '@/shared/storage/db'

import { CustomBackgroundProvider } from './CustomBackgroundProvider'
import {
  CustomBackgroundError,
  createCustomBackgroundThumbnail,
  processCustomBackgroundFile,
} from './custom-background'
import { useCustomBackground } from './custom-background-context'
import { CUSTOM_PHOTO_MAX_BYTES, CUSTOM_PHOTO_MAX_COUNT } from './custom-photos'

vi.mock('./custom-background', async () => {
  const actual = await vi.importActual<typeof import('./custom-background')>('./custom-background')
  return {
    ...actual,
    processCustomBackgroundFile: vi.fn(),
    createCustomBackgroundThumbnail: vi.fn(),
  }
})

function wrapper({ children }: { children: ReactNode }) {
  return <CustomBackgroundProvider>{children}</CustomBackgroundProvider>
}

const file = () => new File(['x'], 'photo.jpg', { type: 'image/jpeg' })

function blobOfSize(size: number) {
  return new Blob([new Uint8Array(size)])
}

async function clearStores() {
  const db = await getDb()
  await db.clear('customPhotos')
  await db.delete('customBackground', 'current')
}

beforeEach(async () => {
  await clearStores()
  vi.mocked(processCustomBackgroundFile)
    .mockReset()
    .mockImplementation(async () => blobOfSize(100))
  vi.mocked(createCustomBackgroundThumbnail)
    .mockReset()
    .mockImplementation(async () => blobOfSize(10))
  let urlCount = 0
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: vi.fn(() => `blob:fake-${urlCount++}`),
    revokeObjectURL: vi.fn(),
  })
})

describe('CustomBackgroundProvider — bibliothèque de photos personnelles', () => {
  it('démarre vide quand rien n’a été ajouté', async () => {
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.photos).toEqual([])
    expect(result.current.usedBytes).toBe(0)
  })

  it('garde PLUSIEURS photos : en ajouter une nouvelle ne remplace pas la précédente', async () => {
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    let first!: Awaited<ReturnType<typeof result.current.add>>
    let second!: Awaited<ReturnType<typeof result.current.add>>
    await act(async () => {
      first = await result.current.add(file())
    })
    await act(async () => {
      second = await result.current.add(file())
    })

    expect(result.current.photos.map((photo) => photo.id)).toEqual([first.id, second.id])
    expect(first.id).not.toBe(second.id)
    expect(first.backgroundId).toBe(`custom:${first.id}`)
    expect(result.current.photos[0].position).toBe('center')
    expect(result.current.usedBytes).toBe(2 * 110)
    expect(result.current.getPhoto(first.id)?.url).toBeTruthy()
  })

  it('les photos persistent : elles reviennent au rechargement', async () => {
    const first = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    let added!: Awaited<ReturnType<typeof first.result.current.add>>
    await act(async () => {
      added = await first.result.current.add(file())
    })
    first.unmount()

    const reloaded = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(reloaded.result.current.status).toBe('ready'))
    expect(reloaded.result.current.photos.map((photo) => photo.id)).toEqual([added.id])
  })

  it('changer le cadrage d’une photo ne touche pas aux autres et persiste', async () => {
    const { result, unmount } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    let a!: { id: string }
    await act(async () => {
      a = await result.current.add(file())
      await result.current.add(file())
    })

    act(() => result.current.setPosition(a.id, 'top'))

    expect(result.current.photos[0].position).toBe('top')
    expect(result.current.photos[1].position).toBe('center')
    await waitFor(async () => {
      expect((await (await getDb()).get('customPhotos', a.id))?.position).toBe('top')
    })
    unmount()
  })

  it('remove() supprime la photo choisie seulement, et libère son URL', async () => {
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    let a!: { id: string }
    let b!: { id: string }
    await act(async () => {
      a = await result.current.add(file())
      b = await result.current.add(file())
    })

    await act(async () => {
      await result.current.remove(a.id)
    })

    expect(result.current.photos.map((photo) => photo.id)).toEqual([b.id])
    expect(URL.revokeObjectURL).toHaveBeenCalled()
    expect(await (await getDb()).get('customPhotos', a.id)).toBeUndefined()
  })

  it('refuse une 13e photo avec un message clair, sans rien traiter', async () => {
    const db = await getDb()
    for (let index = 0; index < CUSTOM_PHOTO_MAX_COUNT; index += 1) {
      await db.put('customPhotos', {
        id: `p${index}`,
        blob: blobOfSize(10),
        thumb: blobOfSize(1),
        position: 'center',
        size: 11,
        createdAt: index,
      })
    }
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.photos).toHaveLength(CUSTOM_PHOTO_MAX_COUNT))

    await expect(act(async () => void (await result.current.add(file())))).rejects.toThrow(
      /limite de 12 photos/,
    )
    expect(processCustomBackgroundFile).not.toHaveBeenCalled()
    expect(result.current.status).toBe('ready')
  })

  it('refuse une photo qui ferait dépasser le poids total (~40 Mo), message clair', async () => {
    const db = await getDb()
    await db.put('customPhotos', {
      id: 'lourde',
      blob: blobOfSize(10),
      thumb: blobOfSize(1),
      position: 'center',
      size: CUSTOM_PHOTO_MAX_BYTES - 50,
      createdAt: 1,
    })
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.photos).toHaveLength(1))

    await expect(act(async () => void (await result.current.add(file())))).rejects.toThrow(
      /bibliothèque est pleine/,
    )
    expect(result.current.photos).toHaveLength(1)
  })

  it('un fichier invalide relance l’erreur de traitement et ne laisse rien en base', async () => {
    vi.mocked(processCustomBackgroundFile).mockRejectedValue(
      new CustomBackgroundError('Choisis un fichier image.'),
    )
    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    await expect(act(async () => void (await result.current.add(file())))).rejects.toThrow(
      'Choisis un fichier image.',
    )
    expect(result.current.photos).toEqual([])
    expect(result.current.status).toBe('ready')
  })

  it('migration douce : l’ancien fond unique rejoint la bibliothèque (id « legacy ») puis son emplacement est libéré', async () => {
    const db = await getDb()
    const legacyBlob = blobOfSize(500)
    await db.put(
      'customBackground',
      { blob: legacyBlob, position: 'bottom', updatedAt: 1234 },
      'current',
    )

    const { result } = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(result.current.status).toBe('ready'))

    expect(result.current.photos).toHaveLength(1)
    expect(result.current.photos[0]).toMatchObject({
      id: 'legacy',
      backgroundId: 'custom:legacy',
      position: 'bottom',
    })
    expect(await db.get('customBackground', 'current')).toBeUndefined()
    const stored = (await db.get('customPhotos', 'legacy')) as CustomPhotoRecord
    expect(stored.createdAt).toBe(1234)
    // (fake-indexeddb ne conserve pas la taille d'un Blob : seul le poids de la vignette compte ici.)
    expect(stored.size).toBeGreaterThan(0)
  })

  it('la migration ne s’exécute qu’une fois et ne duplique jamais la photo', async () => {
    const db = await getDb()
    await db.put(
      'customBackground',
      { blob: blobOfSize(5), position: 'center', updatedAt: 1 },
      'current',
    )
    const first = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    first.unmount()

    const second = renderHook(() => useCustomBackground(), { wrapper })
    await waitFor(() => expect(second.result.current.status).toBe('ready'))
    expect(second.result.current.photos).toHaveLength(1)
  })
})
