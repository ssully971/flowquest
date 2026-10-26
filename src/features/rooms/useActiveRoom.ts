import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'

import {
  RoomsError,
  endRoom,
  getRoomState,
  leaveRoom,
  pauseRoom,
  resumeRoom,
  startRoom,
  transferHost,
} from './rooms-repository'
import { computeRoomView } from './room-timer'
import type { RoomState } from './types'
import { useRoomRealtime } from './useRoomRealtime'

function errorMessage(err: unknown): string {
  return err instanceof RoomsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/**
 * État et actions d'un salon ouvert à l'écran (LOT F3) : chargement initial, abonnement
 * Realtime (useRoomRealtime, reconnexion/repli déjà gérés), et un tick local d'une
 * seconde pendant que le salon tourne, uniquement pour rafraîchir l'affichage du compte à
 * rebours — jamais pour le calcul lui-même, toujours dérivé de `startedAt`/`durationMs`
 * côté serveur (room-timer.ts), donc résistant à la suspension d'onglet.
 */
export function useActiveRoom(roomId: string | null) {
  const { status, user } = useAuth()
  const { showToast } = useToast()
  // L'état est rangé AVEC l'identifiant du salon qui l'a produit : si `roomId` change (je
  // quitte un salon et j'en rejoins un autre), une réponse tardive de l'ancien salon est
  // ignorée et l'ancien état n'est jamais affiché pour le nouveau — plus besoin de remonter
  // le composant (`key`) comme avant, ce qui permet d'héberger ce hook au niveau de l'app.
  const [snapshot, setSnapshot] = useState<{ roomId: string; room: RoomState } | null>(null)
  const [failure, setFailure] = useState<{ roomId: string; message: string } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const room = snapshot && snapshot.roomId === roomId ? snapshot.room : null
  const loadError = failure && failure.roomId === roomId ? failure.message : null
  const isLoading = roomId !== null && room === null && loadError === null

  const refresh = useCallback(() => {
    if (!roomId) return Promise.resolve()
    return getRoomState(roomId)
      .then((next) => {
        if (next) setSnapshot({ roomId, room: next })
        setFailure(null)
      })
      .catch((err: unknown) => {
        setFailure({ roomId, message: errorMessage(err) })
      })
  }, [roomId])

  useEffect(() => {
    if (!roomId || status !== 'authenticated') return
    void refresh()
  }, [roomId, status, refresh])

  useRoomRealtime(roomId, refresh, status === 'authenticated' && roomId !== null)

  const isRunning = room?.status === 'running'
  useEffect(() => {
    if (!isRunning) return
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [isRunning])

  const view = useMemo(() => (room ? computeRoomView(room, nowMs) : null), [room, nowMs])

  const withFeedback = useCallback(
    async (action: () => Promise<void>) => {
      try {
        await action()
        await refresh()
        return true
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return false
      }
    },
    [refresh, showToast],
  )

  const start = useCallback(() => (roomId ? withFeedback(() => startRoom(roomId)) : Promise.resolve(false)), [
    roomId,
    withFeedback,
  ])
  const pause = useCallback(() => (roomId ? withFeedback(() => pauseRoom(roomId)) : Promise.resolve(false)), [
    roomId,
    withFeedback,
  ])
  const resume = useCallback(() => (roomId ? withFeedback(() => resumeRoom(roomId)) : Promise.resolve(false)), [
    roomId,
    withFeedback,
  ])
  const end = useCallback(() => (roomId ? withFeedback(() => endRoom(roomId)) : Promise.resolve(false)), [
    roomId,
    withFeedback,
  ])
  const leave = useCallback(() => (roomId ? withFeedback(() => leaveRoom(roomId)) : Promise.resolve(false)), [
    roomId,
    withFeedback,
  ])
  const transfer = useCallback(
    (newHostId: string) => (roomId ? withFeedback(() => transferHost(roomId, newHostId)) : Promise.resolve(false)),
    [roomId, withFeedback],
  )

  return {
    room,
    view,
    isLoading,
    loadError,
    nowMs,
    isHost: Boolean(room && user && room.hostId === user.id),
    refresh,
    start,
    pause,
    resume,
    end,
    leave,
    transfer,
  }
}
