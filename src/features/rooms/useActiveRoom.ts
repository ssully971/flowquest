import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'
import { strings } from '@/shared/i18n'

import { applyOptimistic } from './room-optimistic'
import type { RoomActionKind } from './room-optimistic'
import { ACTION_TIMEOUT_MS, toRoomsError, withTimeout } from './rooms-errors'
import type { RoomsErrorKind } from './rooms-errors'
import {
  endRoom,
  getRoomState,
  inviteToRoom,
  leaveRoom,
  pauseRoom,
  resumeRoom,
  startRoom,
  transferHost,
} from './rooms-repository'
import { computeRoomView, reconcileRoomClock } from './room-timer'
import type { RoomState } from './types'
import { useRoomRealtime } from './useRoomRealtime'
import type { RoomRealtimeEvent } from './useRoomRealtime'

export type { RoomActionKind }
export { ACTION_TIMEOUT_MS }

/** Dernière action en échec, affichée jusqu'à la prochaine réussite ou fermeture. */
export interface RoomActionError {
  action: RoomActionKind
  message: string
  kind: RoomsErrorKind
  retry: () => void
}

interface UseActiveRoomOptions {
  /** Appelée après une action réussie (ex. recharger la liste de mes salons, rapatrier les
   * sessions enregistrées par le serveur après `end` / `leave`). */
  onActionSuccess?: (action: RoomActionKind) => void | Promise<void>
}

/**
 * État et actions d'un salon ouvert à l'écran :
 *
 *  - SYNCHRONISATION : un seul chargement en vol à la fois, avec coalescence (des évènements
 *    qui arrivent pendant un chargement n'en déclenchent qu'UN de plus, rejoué après), chaque
 *    chargement porte un numéro et une réponse plus ancienne que la dernière appliquée est
 *    ignorée. Un évènement Realtime dont la version est déjà connue, ou qui n'est que l'écho
 *    de mon action en cours, ne recharge rien.
 *  - ACTIONS (lancer, pause, reprise, terminer, quitter, transférer) : verrou anti-double-clic,
 *    mise à jour OPTIMISTE de l'écran, rollback + message clair + Réessayer en cas d'échec,
 *    délai maximum de ACTION_TIMEOUT_MS. L'état est ensuite toujours rechargé du serveur.
 *  - Un tick local d'une seconde pendant que le salon tourne, uniquement pour rafraîchir
 *    l'affichage : le calcul est toujours dérivé de `startedAt`/`durationMs` (room-timer.ts).
 *    L'heure affichée est monotone (jamais en arrière).
 */
export function useActiveRoom(roomId: string | null, options: UseActiveRoomOptions = {}) {
  const { status, user } = useAuth()
  const { showToast } = useToast()
  const userId = user?.id ?? null
  // L'état est rangé AVEC l'identifiant du salon qui l'a produit : si `roomId` change (je
  // quitte un salon et j'en rejoins un autre), une réponse tardive de l'ancien salon est
  // ignorée et l'ancien état n'est jamais affiché pour le nouveau.
  const [snapshot, setSnapshot] = useState<{ roomId: string; room: RoomState } | null>(null)
  const [failure, setFailure] = useState<{ roomId: string; message: string } | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [pendingAction, setPendingAction] = useState<RoomActionKind | null>(null)
  const [actionError, setActionError] = useState<RoomActionError | null>(null)

  // Séquencement / chargement unique.
  const issuedSeqRef = useRef(0)
  const appliedSeqRef = useRef(0)
  const flightRef = useRef<Promise<void> | null>(null)
  const queuedRef = useRef<Promise<void> | null>(null)
  const knownVersionRef = useRef<string | null>(null)
  const snapshotRef = useRef(snapshot)
  const lockRef = useRef(false)
  const actionsInFlightRef = useRef(0)
  const onActionSuccessRef = useRef(options.onActionSuccess)
  useEffect(() => {
    snapshotRef.current = snapshot
  }, [snapshot])
  useEffect(() => {
    onActionSuccessRef.current = options.onActionSuccess
  }, [options.onActionSuccess])

  const room = snapshot && snapshot.roomId === roomId ? snapshot.room : null
  const loadError = failure && failure.roomId === roomId ? failure.message : null
  const isLoading = roomId !== null && room === null && loadError === null

  // Nouveau salon : on oublie tout ce qui concernait l'ancien (chargement en vol compris, dont
  // la réponse tardive serait ignorée par le numéro de séquence).
  useEffect(() => {
    flightRef.current = null
    queuedRef.current = null
    appliedSeqRef.current = issuedSeqRef.current
    knownVersionRef.current = null
  }, [roomId])

  const run = useCallback(async () => {
    if (!roomId) return
    const seq = ++issuedSeqRef.current
    try {
      const next = await getRoomState(roomId)
      // Réponse plus ancienne que la dernière appliquée (arrivée dans le désordre, ou
      // dépassée par une mise à jour optimiste) : ignorée.
      if (seq < appliedSeqRef.current) return
      appliedSeqRef.current = seq
      if (next) {
        knownVersionRef.current = next.updatedAt ?? null
        const now = Date.now()
        setSnapshot((previous) => ({
          roomId,
          room: reconcileRoomClock(
            previous && previous.roomId === roomId ? previous.room : null,
            next,
            now,
          ),
        }))
      }
      setFailure(null)
    } catch (err) {
      if (seq < appliedSeqRef.current) return
      // Un échec passager ne doit pas masquer un salon déjà affiché : la prochaine
      // synchronisation (évènement, retour au premier plan, filet) rattrapera.
      if (snapshotRef.current?.roomId === roomId) return
      setFailure({ roomId, message: toRoomsError(err).message })
    }
  }, [roomId])

  /** Recharge l'état du salon. Un seul chargement à la fois : un appel pendant un chargement
   * en cours en programme UN de plus (rejoué à la suite), jamais un par appel. La promesse
   * rendue se résout quand un chargement lancé APRÈS cet appel est terminé. */
  const refresh = useCallback((): Promise<void> => {
    if (!roomId) return Promise.resolve()
    const start = () => {
      const flight: Promise<void> = run().finally(() => {
        if (flightRef.current === flight) flightRef.current = null
      })
      flightRef.current = flight
      return flight
    }
    const current = flightRef.current
    if (!current) return start()
    if (!queuedRef.current) {
      queuedRef.current = current.then(() => {
        queuedRef.current = null
        return start()
      })
    }
    return queuedRef.current
  }, [roomId, run])

  useEffect(() => {
    if (!roomId || status !== 'authenticated') return
    void refresh()
  }, [roomId, status, refresh])

  const handleEvent = useCallback(
    (event: RoomRealtimeEvent) => {
      if (event.kind === 'room') {
        const known = knownVersionRef.current
        // Version déjà connue (écho d'une action déjà rechargée) : rien à recharger.
        if (event.version && known && Date.parse(event.version) <= Date.parse(known)) return
      }
      // Pendant MON action, l'écho de ses effets est inutile : le rechargement qui la suit les
      // inclut (et tout ce que les autres ont fait entre-temps).
      if (event.kind !== 'resync' && actionsInFlightRef.current > 0) return
      void refresh()
    },
    [refresh],
  )

  const { presentUserIds } = useRoomRealtime(
    roomId,
    handleEvent,
    status === 'authenticated' && roomId !== null,
    userId,
  )

  // Présence « en ligne » : Supabase Presence (aucune écriture en base) quand elle est
  // connectée, sinon l'indicateur de secours du serveur.
  const roomWithPresence = useMemo(() => {
    if (!room || !presentUserIds) return room
    return {
      ...room,
      participants: room.participants.map((participant) => ({
        ...participant,
        isPresent: presentUserIds.has(participant.userId) || participant.userId === userId,
      })),
    }
  }, [room, presentUserIds, userId])

  const isRunning = room?.status === 'running'
  useEffect(() => {
    if (!isRunning) return
    // Monotone : l'heure affichée ne recule jamais, même si l'horloge de l'appareil est recalée.
    const interval = window.setInterval(
      () => setNowMs((previous) => Math.max(previous, Date.now())),
      1000,
    )
    return () => window.clearInterval(interval)
  }, [isRunning])

  const view = useMemo(
    () => (roomWithPresence ? computeRoomView(roomWithPresence, nowMs) : null),
    [roomWithPresence, nowMs],
  )

  const performRef = useRef<
    (action: RoomActionKind, call: () => Promise<void>, targetUserId?: string) => Promise<boolean>
  >(() => Promise.resolve(false))

  const perform = useCallback(
    async (
      action: RoomActionKind,
      call: () => Promise<void>,
      targetUserId?: string,
    ): Promise<boolean> => {
      if (!roomId) return false
      // Anti-double-clic : une seule action à la fois, les clics suivants sont ignorés.
      if (lockRef.current) return false
      lockRef.current = true
      actionsInFlightRef.current += 1
      setPendingAction(action)
      setActionError(null)

      const before = snapshotRef.current
      const base = before && before.roomId === roomId ? before.room : null
      const optimistic = base
        ? applyOptimistic(base, action, { now: Date.now(), userId, targetUserId })
        : null
      if (optimistic) {
        // Les chargements déjà partis datent d'avant l'action : leur réponse serait périmée.
        appliedSeqRef.current = issuedSeqRef.current
        setSnapshot({ roomId, room: optimistic })
      }

      let succeeded = false
      try {
        await withTimeout(call(), ACTION_TIMEOUT_MS)
        succeeded = true
      } catch (err) {
        const failureToShow = toRoomsError(err)
        if (optimistic && base) {
          appliedSeqRef.current = issuedSeqRef.current
          setSnapshot({ roomId, room: base })
        }
        const retry = () => void performRef.current(action, call, targetUserId)
        setActionError({ action, message: failureToShow.message, kind: failureToShow.kind, retry })
        showToast({
          type: 'error',
          message: failureToShow.message,
          action: { label: strings.rooms.retry, onClick: retry },
        })
      } finally {
        lockRef.current = false
        actionsInFlightRef.current -= 1
        setPendingAction(null)
        // Quoi qu'il arrive (succès, échec, délai dépassé où le serveur a peut-être agi), on
        // recharge la vérité du serveur.
        void refresh()
      }
      if (succeeded) await onActionSuccessRef.current?.(action)
      return succeeded
    },
    [roomId, userId, refresh, showToast],
  )
  useEffect(() => {
    performRef.current = perform
  }, [perform])

  const start = useCallback(
    () => (roomId ? perform('start', () => startRoom(roomId)) : Promise.resolve(false)),
    [roomId, perform],
  )
  const pause = useCallback(
    () => (roomId ? perform('pause', () => pauseRoom(roomId)) : Promise.resolve(false)),
    [roomId, perform],
  )
  const resume = useCallback(
    () => (roomId ? perform('resume', () => resumeRoom(roomId)) : Promise.resolve(false)),
    [roomId, perform],
  )
  const end = useCallback(
    () => (roomId ? perform('end', () => endRoom(roomId)) : Promise.resolve(false)),
    [roomId, perform],
  )
  const leave = useCallback(
    () => (roomId ? perform('leave', () => leaveRoom(roomId)) : Promise.resolve(false)),
    [roomId, perform],
  )
  const transfer = useCallback(
    (newHostId: string) =>
      roomId
        ? perform('transfer', () => transferHost(roomId, newHostId), newHostId)
        : Promise.resolve(false),
    [roomId, perform],
  )
  const invite = useCallback(
    (friendIds: string[]) =>
      roomId
        ? perform('invite', async () => {
            await inviteToRoom(roomId, friendIds)
          })
        : Promise.resolve(false),
    [roomId, perform],
  )
  const dismissActionError = useCallback(() => setActionError(null), [])

  return {
    room: roomWithPresence,
    view,
    isLoading,
    loadError,
    nowMs,
    isHost: Boolean(room && user && room.hostId === user.id),
    pendingAction,
    actionError,
    dismissActionError,
    refresh,
    start,
    pause,
    resume,
    end,
    leave,
    transfer,
    invite,
  }
}
