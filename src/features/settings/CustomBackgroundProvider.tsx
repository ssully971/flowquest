import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import type { CustomBackgroundPosition, CustomBackgroundRecord } from '@/shared/storage/db'

import { CustomBackgroundContext } from './custom-background-context'
import type { CustomBackgroundStatus } from './custom-background-context'
import { processCustomBackgroundFile } from './custom-background'
import { IndexedDbCustomBackgroundRepository } from './storage/custom-background-repository'

const repository = new IndexedDbCustomBackgroundRepository()

export function CustomBackgroundProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<CustomBackgroundStatus>('loading')
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [position, setPositionState] = useState<CustomBackgroundPosition>('center')
  const objectUrlRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void repository.load().then((record) => {
      if (cancelled) return
      if (!record) {
        setStatus('empty')
        return
      }
      const url = URL.createObjectURL(record.blob)
      objectUrlRef.current = url
      setObjectUrl(url)
      setPositionState(record.position)
      setStatus('ready')
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Libère le dernier object URL créé quand le fournisseur est démonté (navigation hors de
  // l'app, pas seulement un changement de fond — géré directement dans upload/remove).
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  const upload = useCallback(async (file: File) => {
    setStatus('uploading')
    try {
      const blob = await processCustomBackgroundFile(file)
      const record: CustomBackgroundRecord = { blob, position: 'center', updatedAt: Date.now() }
      await repository.save(record)

      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      const url = URL.createObjectURL(blob)
      objectUrlRef.current = url
      setObjectUrl(url)
      setPositionState('center')
      setStatus('ready')
    } catch (error) {
      setStatus(objectUrlRef.current ? 'ready' : 'empty')
      throw error
    }
  }, [])

  const setPosition = useCallback((next: CustomBackgroundPosition) => {
    setPositionState(next)
    void repository.load().then((current) => {
      if (!current) return
      void repository.save({ ...current, position: next, updatedAt: Date.now() })
    })
  }, [])

  const remove = useCallback(async () => {
    await repository.remove()
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
    setObjectUrl(null)
    setPositionState('center')
    setStatus('empty')
  }, [])

  const value = useMemo(
    () => ({ status, objectUrl, position, upload, setPosition, remove }),
    [status, objectUrl, position, upload, setPosition, remove],
  )

  return (
    <CustomBackgroundContext.Provider value={value}>{children}</CustomBackgroundContext.Provider>
  )
}
