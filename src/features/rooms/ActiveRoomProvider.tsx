import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useActivePillar } from '@/features/pillars/active-pillar-context'
import { reconcilePillarFromServer } from '@/features/pillars/apply-session-xp'
import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { pullRemoteFocusSessions } from '@/features/stats/useSessionSync'
import { notifySegmentFinished } from '@/features/timer/notifications'
import { fireSessionEndConfetti } from '@/features/timer/session-end-confetti'
import { pauseStoredSoloTimerIfRunning } from '@/features/timer/solo-timer-guard'
import { useTimerSettings } from '@/features/timer/timer-settings-context'

import { ActiveGroupRoomContext } from './active-room-context'
import { pickActiveRoom } from './active-room'
import type { ActiveGroupRoomValue } from './active-room-context'
import { setRoomPillar } from './rooms-repository'
import type { RoomPhase, RoomState } from './types'
import { useActiveRoom } from './useActiveRoom'
import { useRoomPresence } from './useRoomPresence'
import { useRooms } from './useRooms'

/**
 * Hébergé UNE fois à la racine de l'application (LOT M3) : la session de groupe vit côté
 * serveur, ici on ne fait que la refléter. Tout ce qui doit survivre au changement
 * d'écran en dépend : l'horloge de groupe (Focus, Ambiant), le bouton flottant « Session en
 * cours », le statut en direct, les alertes de changement de phase, le rapatriement des
 * sessions enregistrées par le serveur, le pilier rattaché.
 */
export function ActiveRoomProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth()
  const { settings: timerSettings } = useTimerSettings()
  const { settings: extrasSettings } = useExtrasSettings()
  const { activePillarId } = useActivePillar()

  const roomsState = useRooms()
  const { refresh: refreshRooms } = roomsState
  useRoomPresence(roomsState.rooms.length > 0)

  const activeListed = pickActiveRoom(roomsState.rooms)
  // Identifiant « collant » : la liste (list_my_rooms) exclut les salons terminés et peut se
  // rafraîchir avant que l'état du salon n'ait montré sa fin. Tant que je n'ai pas VU ce
  // salon terminé (ou que je ne l'ai pas quitté), on continue de le charger — sinon l'écran
  // de fin, les confettis et le rapatriement des sessions seraient perdus.
  const [stickyRoomId, setStickyRoomId] = useState<string | null>(null)
  if (activeListed && stickyRoomId !== activeListed.roomId) setStickyRoomId(activeListed.roomId)
  const api = useActiveRoom(activeListed?.roomId ?? stickyRoomId)

  // Je ne suis « dans » le salon que tant que le serveur me compte comme participant rejoint
  // (après « Quitter », la liste met un instant à se rafraîchir).
  const me = user ? api.room?.participants.find((p) => p.userId === user.id) : undefined
  const isJoined = me?.status === 'joined'
  const room: RoomState | null =
    api.room && api.room.status !== 'ended' && isJoined ? api.room : null
  const view = room ? api.view : null

  // ── Écran de fin : conservé jusqu'à fermeture, même quand la liste ne contient plus le salon.
  const [endedRoom, setEndedRoom] = useState<RoomState | null>(null)
  const [dismissedRoomId, setDismissedRoomId] = useState<string | null>(null)
  if (
    api.room &&
    api.room.status === 'ended' &&
    isJoined &&
    endedRoom?.roomId !== api.room.roomId &&
    dismissedRoomId !== api.room.roomId
  ) {
    setEndedRoom(api.room)
  }
  const stickyResolved =
    stickyRoomId !== null &&
    !activeListed &&
    api.room?.roomId === stickyRoomId &&
    (api.room.status === 'ended' || !isJoined)
  if (stickyResolved) setStickyRoomId(null)
  const dismissEnded = useCallback(() => {
    setDismissedRoomId(endedRoom?.roomId ?? null)
    setEndedRoom(null)
  }, [endedRoom])

  // ── Sessions de groupe : le serveur les enregistre (migration 0049), on les rapatrie.
  const syncSessions = useCallback(async () => {
    if (!user) return
    await pullRemoteFocusSessions(user.id)
    if (activePillarId) await reconcilePillarFromServer(activePillarId)
  }, [user, activePillarId])

  // ── Heure du serveur : si l'horloge locale a déjà franchi une frontière (fin de phase ou
  // de minuteur), on recharge tout de suite l'état plutôt que d'attendre un évènement.
  const refresh = api.refresh
  const lastBoundaryRef = useRef<string | null>(null)
  const boundaryKey =
    room && view && (view.isOver || view.phaseIndex !== room.phaseIndex)
      ? `${room.roomId}:${view.phaseIndex}:${view.isOver}`
      : null
  useEffect(() => {
    if (boundaryKey === null || lastBoundaryRef.current === boundaryKey) return
    lastBoundaryRef.current = boundaryKey
    void refresh().then(syncSessions)
  }, [boundaryKey, refresh, syncSessions])

  // ── Alertes (son, notification) à chaque changement de phase Pomodoro.
  const alertPrefs = useMemo(
    () => ({
      soundEnabled: timerSettings.soundEnabled,
      notificationsEnabled: timerSettings.notificationsEnabled,
      alertSoundId: timerSettings.alertSoundId,
      alertVolume: timerSettings.alertVolume,
    }),
    [
      timerSettings.soundEnabled,
      timerSettings.notificationsEnabled,
      timerSettings.alertSoundId,
      timerSettings.alertVolume,
    ],
  )
  const alertedRef = useRef<{ roomId: string; phaseIndex: number } | null>(null)
  const lastPhaseRef = useRef<RoomPhase | null>(null)
  const phaseIndex = view?.phaseIndex ?? null
  const phase = view?.phase ?? null
  const activeRoomKey = room?.roomId ?? null
  useEffect(() => {
    if (activeRoomKey === null || phaseIndex === null || phase === null) return
    const previous = alertedRef.current
    alertedRef.current = { roomId: activeRoomKey, phaseIndex }
    if (previous && previous.roomId === activeRoomKey && phaseIndex > previous.phaseIndex) {
      // La phase qui vient de se terminer est la PRÉCÉDENTE (celle affichée avant ce changement).
      notifySegmentFinished(lastPhaseRef.current ?? 'focus', alertPrefs)
    }
    lastPhaseRef.current = phase
  }, [activeRoomKey, phaseIndex, phase, alertPrefs])

  // ── Fin de session (naturelle ou par l'hôte) : alerte, confettis, rapatriement des sessions
  // que le serveur a enregistrées. Une seule fois par salon.
  const endedAlertedRef = useRef<string | null>(null)
  const endedId = endedRoom?.roomId ?? null
  useEffect(() => {
    if (endedId === null || endedAlertedRef.current === endedId) return
    endedAlertedRef.current = endedId
    notifySegmentFinished(lastPhaseRef.current ?? 'focus', alertPrefs)
    if (timerSettings.confettiEnabled) fireSessionEndConfetti()
    void syncSessions()
  }, [endedId, alertPrefs, timerSettings.confettiEnabled, syncSessions])

  // ── Pilier rattaché à mes sessions de ce salon.
  const syncedPillarRef = useRef<string | null>(null)
  const pillarForRoom = extrasSettings.pillarsEnabled ? activePillarId : null
  const activeRoomId = room?.roomId ?? null
  useEffect(() => {
    if (activeRoomId === null) {
      syncedPillarRef.current = null
      return
    }
    const key = `${activeRoomId}:${pillarForRoom ?? ''}`
    if (syncedPillarRef.current === key) return
    syncedPillarRef.current = key
    void setRoomPillar(activeRoomId, pillarForRoom).catch(() => {
      // Best-effort : le pilier choisi à l'arrivée reste valable.
    })
  }, [activeRoomId, pillarForRoom])

  // ── Le minuteur personnel est mis en pause dès qu'une session de groupe devient active.
  const soloPausedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (activeRoomId === null) {
      soloPausedForRef.current = null
      return
    }
    if (soloPausedForRef.current === activeRoomId) return
    soloPausedForRef.current = activeRoomId
    void pauseStoredSoloTimerIfRunning().catch(() => undefined)
  }, [activeRoomId])

  // ── Actions : après chacune, la liste de mes salons est rechargée et les sessions
  // enregistrées par le serveur rapatriées.
  const { start, pause, resume, transfer, end, leave } = api
  const actions = useMemo(
    () => ({
      start,
      pause,
      resume,
      transfer,
      end: async () => {
        const ok = await end()
        if (ok) {
          await refreshRooms()
          await syncSessions()
        }
        return ok
      },
      leave: async () => {
        const ok = await leave()
        if (ok) {
          await refreshRooms()
          await syncSessions()
        }
        return ok
      },
    }),
    [start, pause, resume, transfer, end, leave, refreshRooms, syncSessions],
  )

  const value = useMemo<ActiveGroupRoomValue>(
    () => ({
      roomsState,
      room: status === 'authenticated' ? room : null,
      view: status === 'authenticated' ? view : null,
      endedRoom: status === 'authenticated' ? endedRoom : null,
      isHost: Boolean(room && user && room.hostId === user.id),
      isLoading: api.isLoading,
      loadError: api.loadError,
      nowMs: api.nowMs,
      actions,
      dismissEnded,
    }),
    [roomsState, status, room, view, endedRoom, user, api.isLoading, api.loadError, api.nowMs, actions, dismissEnded],
  )

  return <ActiveGroupRoomContext.Provider value={value}>{children}</ActiveGroupRoomContext.Provider>
}
