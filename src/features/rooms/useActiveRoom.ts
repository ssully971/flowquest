import { useCallback, useEffect, useState } from 'react'

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
  const [room, setRoom] = useState<RoomState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const refresh = useCallback(() => {
    if (!roomId) return Promise.resolve()
    return getRoomState(roomId)
      .then((next) => {
        setRoom(next)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [roomId])

  // Pas de remise à `true` de isLoading ici en cas de changement de roomId (appellerait
  // setState de façon synchrone dans l'effet) : le composant appelant doit monter un
  // <RoomScreen key={roomId}> frais pour changer de salon, ce qui réinitialise le hook
  // entièrement plutôt que de réutiliser un état obsolète.
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
