import { createContext, useContext } from 'react'

import type { RoomClockView } from './room-timer'
import type { RoomState } from './types'
import type { RoomsState } from './useRooms'

export interface GroupRoomActions {
  start: () => Promise<boolean>
  pause: () => Promise<boolean>
  resume: () => Promise<boolean>
  end: () => Promise<boolean>
  leave: () => Promise<boolean>
  transfer: (newHostId: string) => Promise<boolean>
}

/** La session de groupe de l'utilisateur, source de vérité UNIQUE de l'horloge de groupe
 * (LOT M3) : l'état vient du salon côté serveur (useActiveRoom + useRoomRealtime), jamais
 * d'un compteur local. Les écrans (Focus, Ambiant, bouton flottant, statut en direct) ne
 * font que le lire. */
export interface ActiveGroupRoomValue {
  /** Mes salons (liste + invitations), partagés avec le panneau social. */
  roomsState: RoomsState
  /** Salon actif dont je suis participant (en attente, en cours ou en pause), sinon null. */
  room: RoomState | null
  /** Ce que l'horloge doit afficher maintenant (3 modes, phase Pomodoro déduite). */
  view: RoomClockView | null
  /** Dernier salon terminé, affiché jusqu'à ce que je ferme l'écran de fin. */
  endedRoom: RoomState | null
  isHost: boolean
  isLoading: boolean
  loadError: string | null
  nowMs: number
  actions: GroupRoomActions
  dismissEnded: () => void
}

const NOOP = () => Promise.resolve(false)

const INERT_ROOMS_STATE: RoomsState = {
  rooms: [],
  isLoading: false,
  loadError: null,
  refresh: () => Promise.resolve(),
  create: () => Promise.resolve(null),
  respond: () => Promise.resolve(false),
}

/** Valeur par défaut sans fournisseur (tests, pages hors application) : aucune session. */
export const INERT_ACTIVE_ROOM: ActiveGroupRoomValue = {
  roomsState: INERT_ROOMS_STATE,
  room: null,
  view: null,
  endedRoom: null,
  isHost: false,
  isLoading: false,
  loadError: null,
  nowMs: 0,
  actions: { start: NOOP, pause: NOOP, resume: NOOP, end: NOOP, leave: NOOP, transfer: NOOP },
  dismissEnded: () => undefined,
}

export const ActiveGroupRoomContext = createContext<ActiveGroupRoomValue>(INERT_ACTIVE_ROOM)

export function useActiveGroupRoom(): ActiveGroupRoomValue {
  return useContext(ActiveGroupRoomContext)
}
