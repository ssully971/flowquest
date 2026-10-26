import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { getActivePillarId } from '@/features/pillars/active-pillar-ref'
import { getPillarsEnabled } from '@/features/settings/pillars-enabled-ref'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { RoomsError, createRoom, listMyRooms, respondRoomInvite } from './rooms-repository'
import type { RoomDraft } from './components/CreateRoomForm'
import type { MyRoom } from './types'
import { useRoomInvitesRealtime } from './useRoomInvitesRealtime'

/** Pilier rattaché à mes sessions de groupe : le pilier actif, si les piliers sont activés. */
function currentPillarId(): string | null {
  return getPillarsEnabled() ? getActivePillarId() : null
}

function errorMessage(err: unknown): string {
  return err instanceof RoomsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/** Mes salons (LOT F3) : invitations en attente et salons actifs, pour l'onglet « Mes
 * salons » du panneau. Realtime (LOT H1, useRoomInvitesRealtime) détecte une invitation
 * dès qu'elle arrive — le salon ouvert lui-même (useActiveRoom) a son propre canal
 * dédié (useRoomRealtime, filtré sur son room_id). */
export function useRooms() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<MyRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Dernières invitations en attente connues (LOT H1) : permet de ne saluer que celles
  // qui viennent d'apparaître, jamais au tout premier chargement (ref encore `null`).
  const previousInvitedIdsRef = useRef<Set<string> | null>(null)
  // Référence vers `respond` (LOT H2, §1 — toast avec « Accepter ») : `refresh` en a
  // besoin pour l'action du toast, mais `respond` est défini plus bas et dépend lui-même
  // de `refresh` — tenue à jour à chaque rendu plutôt que réordonnée pour éviter une
  // dépendance circulaire entre les deux useCallback.
  const respondRef = useRef<(roomId: string, accept: boolean) => Promise<boolean>>(
    () => Promise.resolve(false),
  )

  const refresh = useCallback(() => {
    return listMyRooms()
      .then((next) => {
        setRooms(next)
        setLoadError(null)

        const invited = next.filter((room) => room.myStatus === 'invited')
        const invitedIds = new Set(invited.map((room) => room.roomId))
        if (previousInvitedIdsRef.current) {
          const previous = previousInvitedIdsRef.current
          for (const room of invited) {
            if (previous.has(room.roomId)) continue
            showToast({
              type: 'info',
              message: `${room.hostDisplayName ?? room.hostUsername} t’invite à un salon de focus.`,
              action: {
                label: strings.rooms.accept,
                onClick: () => void respondRef.current(room.roomId, true),
              },
            })
          }
        }
        previousInvitedIdsRef.current = invitedIds
      })
      .catch((err: unknown) => {
        setLoadError(errorMessage(err))
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [showToast])

  useEffect(() => {
    if (status !== 'authenticated') return
    void refresh()
  }, [status, refresh])

  // Invitations à un salon en temps réel (LOT H1), plus besoin de rouvrir le panneau
  // pour les voir apparaître.
  useRoomInvitesRealtime(refresh, status === 'authenticated')

  const create = useCallback(
    async (draft: RoomDraft, friendIds: string[]): Promise<string | null> => {
      try {
        const roomId = await createRoom({ ...draft, friendIds, pillarId: currentPillarId() })
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
        await respondRoomInvite(roomId, accept, accept ? currentPillarId() : null)
        await refresh()
        return true
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return false
      }
    },
    [refresh, showToast],
  )
  useEffect(() => {
    respondRef.current = respond
  }, [respond])

  return { rooms, isLoading, loadError, refresh, create, respond }
}

export type RoomsState = ReturnType<typeof useRooms>
