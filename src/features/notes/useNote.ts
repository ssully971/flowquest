import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'

import { IndexedDbNoteRepository } from './storage/indexed-db-note-repository'
import { SupabaseNoteRepository } from './storage/supabase-note-repository'

const localRepo = new IndexedDbNoteRepository()
const remoteRepo = new SupabaseNoteRepository()
const AUTOSAVE_DEBOUNCE_MS = 600

export interface UseNoteResult {
  content: string
  setContent: (next: string) => void
  isLoaded: boolean
  isSaving: boolean
}

/**
 * Note rapide unique par utilisateur : local d'abord (IndexedDB), enregistrement
 * automatique après une courte pause de frappe (jamais à chaque caractère), puis
 * synchro Supabase si connecté. À la connexion, tire une fois la version distante et
 * l'applique seulement si elle est plus récente (dernier horodatage gagne).
 */
export function useNote(): UseNoteResult {
  const { status, user } = useAuth()
  const [content, setContentState] = useState('')
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const pulledForUserRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void localRepo.load().then((stored) => {
      if (cancelled) return
      setContentState(stored?.content ?? '')
      setIsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !user) return
    if (pulledForUserRef.current === user.id) return
    pulledForUserRef.current = user.id

    let cancelled = false
    void (async () => {
      const [local, remote] = await Promise.all([localRepo.load(), remoteRepo.load(user.id)])
      if (cancelled || !remote) return
      if (local && local.updatedAt >= remote.updatedAt) return
      setContentState(remote.content)
      await localRepo.save(remote.content, remote.updatedAt)
    })()
    return () => {
      cancelled = true
    }
  }, [status, user])

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [])

  const setContent = useCallback(
    (next: string) => {
      setContentState(next)
      setIsSaving(true)
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
      debounceRef.current = window.setTimeout(() => {
        const updatedAt = Date.now()
        void localRepo.save(next, updatedAt).then(() => setIsSaving(false))
        if (status === 'authenticated' && user) {
          void remoteRepo.save(user.id, next, updatedAt)
        }
      }, AUTOSAVE_DEBOUNCE_MS)
    },
    [status, user],
  )

  return { content, setContent, isLoaded, isSaving }
}
