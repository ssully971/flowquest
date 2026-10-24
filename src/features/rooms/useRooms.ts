import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'

import { RoomsError, createRoom, listMyRooms, respondRoomInvite } from './rooms-repository'
import type { MyRoom } from './types'

function errorMessage(err: unknown): string {
  return err instanceof RoomsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/** Mes salons (LOT F3) : invitations en attente et salons actifs, pour l'onglet « Mes
 * salons » du panneau — pas d'abonnement Realtime dédié ici (peu d'évènements, une
 * invitation ou un salon créé par un ami reste rare) : un simple rechargement après
 * chaque action locale suffit ; le salon ouvert lui-même (useActiveRoom) a son propre
 * canal temps réel. */
export function useRooms() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<MyRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    return listMyRooms()
      .then((next) => {
        setRooms(next)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    void refresh()
  }, [status, refresh])

  const create = useCallback(
    async (focusMinutes: number, friendIds: string[]): Promise<string | null> => {
      try {
        const roomId = await createRoom(focusMinutes, friendIds)
        await refresh()
        return roomId
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return null
      }
    },
    [refresh, showToast],
  )

  const respond = useCallback(
    async (roomId: string, accept: boolean): Promise<boolean> => {
      try {
        await respondRoomInvite(roomId, accept)
        await refresh()
        return true
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return false
      }
    },
    [refresh, showToast],
  )

  return { rooms, isLoading, loadError, refresh, create, respond }
}
