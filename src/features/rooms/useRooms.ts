import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { getActivePillarId } from '@/features/pillars/active-pillar-ref'
import { getPillarsEnabled } from '@/features/settings/pillars-enabled-ref'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { toRoomsError, withTimeout } from './rooms-errors'
import { createRoom, listMyRooms, respondRoomInvite } from './rooms-repository'
import type { RoomDraft } from './components/CreateRoomForm'
import type { MyRoom } from './types'
import { useRoomInvitesRealtime } from './useRoomInvitesRealtime'

/** Pilier rattaché à mes sessions de groupe : le pilier actif, si les piliers sont activés. */
function currentPillarId(): string | null {
  return getPillarsEnabled() ? getActivePillarId() : null
}

function errorMessage(err: unknown): string {
  return toRoomsError(err).message
}

/** Mes salons (LOT F3) : invitations en attente et salons actifs, pour l'onglet « Mes
 * salons » du panneau. Realtime (LOT H1, useRoomInvitesRealtime) détecte une invitation
 * dès qu'elle arrive — le salon ouvert lui-même (useActiveRoom) a son propre canal
 * dédié (useRoomRealtime, filtré sur son room_id). L'avertissement visible (bannière avec
 * Rejoindre / Refuser, partout sur le site) est assuré par SocialInvitesBanner (LOT M4),
 * plus par un toast éphémère ici. */
export function useRooms() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const [rooms, setRooms] = useState<MyRoom[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Réponse à une invitation en cours (bouton désactivé + spinner) et verrou anti-double-clic.
  const [responding, setResponding] = useState<{ roomId: string; accept: boolean } | null>(null)
  const respondingRef = useRef(false)
  const respondRef = useRef<(roomId: string, accept: boolean) => Promise<boolean>>(() =>
    Promise.resolve(false),
  )
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

  // Invitations à un salon en temps réel (LOT H1), plus besoin de rouvrir le panneau
  // pour les voir apparaître.
  useRoomInvitesRealtime(refresh, status === 'authenticated')

  const create = useCallback(
    async (draft: RoomDraft, friendIds: string[]): Promise<string | null> => {
      try {
        const roomId = await withTimeout(
          createRoom({ ...draft, friendIds, pillarId: currentPillarId() }),
        )
        await refresh()
        return roomId
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        // Délai dépassé : le salon a peut-être été créé quand même (la création n'est pas
        // rejouée automatiquement, pour ne jamais en créer deux) — la liste le montrera.
        void refresh()
        return null
      }
    },
    [refresh, showToast],
  )

  const respond = useCallback(
    async (roomId: string, accept: boolean): Promise<boolean> => {
      if (respondingRef.current) return false
      respondingRef.current = true
      setResponding({ roomId, accept })
      try {
        await withTimeout(respondRoomInvite(roomId, accept, accept ? currentPillarId() : null))
        await refresh()
        return true
      } catch (err) {
        showToast({
          type: 'error',
          message: errorMessage(err),
          action: { label: strings.rooms.retry, onClick: () => void respondRef.current(roomId, accept) },
        })
        return false
      } finally {
        respondingRef.current = false
        setResponding(null)
      }
    },
    [refresh, showToast],
  )
  useEffect(() => {
    respondRef.current = respond
  }, [respond])

  return { rooms, isLoading, loadError, refresh, create, respond, responding }
}

export type RoomsState = ReturnType<typeof useRooms>
