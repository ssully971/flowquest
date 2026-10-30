import { createContext, useContext } from 'react'

import type { RoomActionKind } from './room-optimistic'
import type { RoomClockView } from './room-timer'
import type { RoomActionError } from './useActiveRoom'
import type { MyRoom, RoomState } from './types'
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
  /** Salon dont l'état est en cours de chargement (je viens de cliquer, le serveur n'a pas
   * encore répondu) : ce que `list_my_rooms` en sait déjà (statut, mode, phase) permet
   * d'afficher tout de suite un écran de « Connexion au salon… ». `null` sinon. */
  connecting: MyRoom | null
  /** Recharge le salon (bouton « Réessayer » de l'écran de connexion). */
  retryLoad: () => void
  /** Action en cours (bouton désactivé + libellé « Lancement… »), `null` sinon. */
  pendingAction: RoomActionKind | null
  /** Dernière action en échec (message clair + Réessayer), `null` sinon. */
  actionError: RoomActionError | null
  dismissActionError: () => void
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
  responding: null,
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
  connecting: null,
  retryLoad: () => undefined,
  pendingAction: null,
  actionError: null,
  dismissActionError: () => undefined,
  nowMs: 0,
  actions: { start: NOOP, pause: NOOP, resume: NOOP, end: NOOP, leave: NOOP, transfer: NOOP },
  dismissEnded: () => undefined,
}

export const ActiveGroupRoomContext = createContext<ActiveGroupRoomValue>(INERT_ACTIVE_ROOM)

export function useActiveGroupRoom(): ActiveGroupRoomValue {
  return useContext(ActiveGroupRoomContext)
}
