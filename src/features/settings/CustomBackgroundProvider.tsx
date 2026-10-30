import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { strings } from '@/shared/i18n'
import type { CustomBackgroundPosition, CustomPhotoRecord } from '@/shared/storage/db'

import { CustomBackgroundContext } from './custom-background-context'
import type { CustomBackgroundStatus, CustomPhoto } from './custom-background-context'
import {
  CustomBackgroundError,
  createCustomBackgroundThumbnail,
  processCustomBackgroundFile,
} from './custom-background'
import {
  CUSTOM_PHOTO_MAX_BYTES,
  CUSTOM_PHOTO_MAX_COUNT,
  LEGACY_PHOTO_ID,
  checkPhotoLimits,
  formatMegabytes,
  toCustomBackgroundId,
} from './custom-photos'
import { IndexedDbCustomBackgroundRepository } from './storage/custom-background-repository'
import { IndexedDbCustomPhotoRepository } from './storage/custom-photo-repository'

const photoRepository = new IndexedDbCustomPhotoRepository()
const legacyRepository = new IndexedDbCustomBackgroundRepository()

/**
 * Bibliothèque de fonds personnels : plusieurs photos persistantes (IndexedDB), chacune
 * utilisable comme fond de n'importe quel mode (`custom:<id>`) ; supprimer ou changer de fond ne
 * touche jamais aux autres photos. Au premier chargement, l'ancien fond unique est repris dans la
 * bibliothèque (id `legacy`, et l'ancien identifiant `custom` y renvoie), puis son emplacement est
 * libéré.
 */
export function CustomBackgroundProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CustomBackgroundStatus>('loading')
  const [records, setRecords] = useState<CustomPhotoRecord[]>([])
  const [urls, setUrls] = useState<Record<string, { url: string; thumbUrl: string }>>({})
  const urlsRef = useRef<Record<string, { url: string; thumbUrl: string }>>({})

  const createUrls = useCallback((record: CustomPhotoRecord) => {
    const created = {
      url: URL.createObjectURL(record.blob),
      thumbUrl: URL.createObjectURL(record.thumb),
    }
    urlsRef.current = { ...urlsRef.current, [record.id]: created }
    return created
  }, [])

  const revokeUrls = useCallback((id: string) => {
    const existing = urlsRef.current[id]
    if (!existing) return
    URL.revokeObjectURL(existing.url)
    URL.revokeObjectURL(existing.thumbUrl)
    const rest = { ...urlsRef.current }
    delete rest[id]
    urlsRef.current = rest
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      let loaded = await photoRepository.list()
      // Migration douce de l'ancien fond unique vers la bibliothèque.
      const legacy = await legacyRepository.load()
      if (legacy) {
        if (!loaded.some((photo) => photo.id === LEGACY_PHOTO_ID)) {
          const thumb = await createCustomBackgroundThumbnail(legacy.blob)
          const migrated: CustomPhotoRecord = {
            id: LEGACY_PHOTO_ID,
            blob: legacy.blob,
            thumb,
            position: legacy.position,
            size: (legacy.blob.size || 0) + (thumb.size || 0),
            createdAt: legacy.updatedAt,
          }
          await photoRepository.put(migrated)
          loaded = [...loaded, migrated]
        }
        await legacyRepository.remove()
      }
      if (cancelled) return
      const nextUrls: Record<string, { url: string; thumbUrl: string }> = {}
      for (const record of loaded) nextUrls[record.id] = createUrls(record)
      setUrls(nextUrls)
      setRecords(loaded)
      setStatus('ready')
    })()
    return () => {
      cancelled = true
    }
  }, [createUrls])

  // Libère toutes les URL d'objet quand le fournisseur est démonté.
  useEffect(() => {
    return () => {
      for (const { url, thumbUrl } of Object.values(urlsRef.current)) {
        URL.revokeObjectURL(url)
        URL.revokeObjectURL(thumbUrl)
      }
    }
  }, [])

  const photos = useMemo<CustomPhoto[]>(
    () =>
      records
        .filter((record) => urls[record.id])
        .map((record) => ({
          id: record.id,
          backgroundId: toCustomBackgroundId(record.id),
          url: urls[record.id].url,
          thumbUrl: urls[record.id].thumbUrl,
          position: record.position,
          size: record.size,
        })),
    [records, urls],
  )
  const usedBytes = useMemo(() => records.reduce((sum, record) => sum + record.size, 0), [records])

  const add = useCallback(
    async (file: File): Promise<CustomPhoto> => {
      const s = strings.settings.themes.customBackground
      // Plafond du nombre de photos vérifié AVANT tout traitement coûteux.
      if (checkPhotoLimits(records, 0).ok === false && records.length >= CUSTOM_PHOTO_MAX_COUNT) {
        throw new CustomBackgroundError(
          s.limitCount.replace('{max}', String(CUSTOM_PHOTO_MAX_COUNT)),
        )
      }
      setStatus('uploading')
      try {
        const blob = await processCustomBackgroundFile(file)
        const thumb = await createCustomBackgroundThumbnail(blob)
        const size = blob.size + thumb.size
        const check = checkPhotoLimits(records, size)
        if (!check.ok) {
          throw new CustomBackgroundError(
            check.limit === 'count'
              ? s.limitCount.replace('{max}', String(CUSTOM_PHOTO_MAX_COUNT))
              : s.limitSize
                  .replace('{max}', formatMegabytes(CUSTOM_PHOTO_MAX_BYTES))
                  .replace('{used}', formatMegabytes(usedBytes)),
          )
        }
        const record: CustomPhotoRecord = {
          id: crypto.randomUUID(),
          blob,
          thumb,
          position: 'center',
          size,
          createdAt: Date.now(),
        }
        await photoRepository.put(record)
        const created = createUrls(record)
        setUrls((previous) => ({ ...previous, [record.id]: created }))
        setRecords((previous) => [...previous, record])
        return {
          id: record.id,
          backgroundId: toCustomBackgroundId(record.id),
          url: created.url,
          thumbUrl: created.thumbUrl,
          position: record.position,
          size,
        }
      } finally {
        setStatus('ready')
      }
    },
    [records, usedBytes, createUrls],
  )

  const remove = useCallback(
    async (id: string) => {
      await photoRepository.remove(id)
      revokeUrls(id)
      setUrls((previous) => {
        const rest = { ...previous }
        delete rest[id]
        return rest
      })
      setRecords((previous) => previous.filter((record) => record.id !== id))
    },
    [revokeUrls],
  )

  const setPosition = useCallback((id: string, position: CustomBackgroundPosition) => {
    setRecords((previous) =>
      previous.map((record) => (record.id === id ? { ...record, position } : record)),
    )
    void photoRepository.get(id).then((current) => {
      if (current) void photoRepository.put({ ...current, position })
    })
  }, [])

  const getPhoto = useCallback(
    (id: string) => photos.find((photo) => photo.id === id) ?? null,
    [photos],
  )

  const value = useMemo(
    () => ({
      status,
      photos,
      usedBytes,
      maxPhotos: CUSTOM_PHOTO_MAX_COUNT,
      maxBytes: CUSTOM_PHOTO_MAX_BYTES,
      add,
      remove,
      setPosition,
      getPhoto,
    }),
    [status, photos, usedBytes, add, remove, setPosition, getPhoto],
  )

  return (
    <CustomBackgroundContext.Provider value={value}>{children}</CustomBackgroundContext.Provider>
  )
}
