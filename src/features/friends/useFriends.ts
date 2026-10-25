import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'
import type { CheerEmoji } from '@/shared/supabase/database.types'

import {
  FriendsError,
  blockUser,
  cancelFriendRequest,
  findProfilePreview,
  listFriendRequests,
  listFriends,
  regenerateFriendCode,
  removeFriend,
  reportUser,
  respondFriendRequest,
  sendCheer,
  sendFriendRequest,
  unblockUser,
} from './friends-repository'
import type { Friend, FriendProfilePreview, FriendRequest } from './types'
import { useFriendsRealtime } from './useFriendsRealtime'
import { useFriendshipsRealtime } from './useFriendshipsRealtime'

function errorMessage(err: unknown): string {
  return err instanceof FriendsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/**
 * Charge et tient à jour amis + demandes (LOT F1), avec abonnement Realtime au statut en
 * direct depuis le LOT F2 (useFriendsRealtime) : chaque action locale déclenche aussi un
 * rechargement explicite (withFeedback), donc la liste reste à jour même si le canal
 * Realtime venait à tomber.
 */
export function useFriends() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Dernier jeu de demandes entrantes connu (LOT H1) : permet de détecter une nouvelle
  // demande arrivée entre deux rafraîchissements (déclenchés par Realtime ou non — peu
  // importe la cause, toute demande entrante absente la dernière fois mérite un toast).
  // `null` tant qu'aucun chargement n'a abouti : jamais de toast au tout premier chargement.
  const previousIncomingIdsRef = useRef<Set<string> | null>(null)

  // Non async : seuls les .then()/.catch()/.finally() appellent setState, jamais le corps
  // synchrone de la fonction elle-même (une fonction async appelée depuis un effet
  // exécute tout son code avant le premier await dans le même tick que l'effet — c'est ce
  // que la règle react-hooks/set-state-in-effect signale).
  const refresh = useCallback(() => {
    return Promise.all([listFriends(), listFriendRequests()])
      .then(([nextFriends, nextRequests]) => {
        setFriends(nextFriends)
        setRequests(nextRequests)
        setLoadError(null)

        const incoming = nextRequests.filter((request) => request.direction === 'incoming')
        const incomingIds = new Set(incoming.map((request) => request.friendshipId))
        if (previousIncomingIdsRef.current) {
          const previous = previousIncomingIdsRef.current
          for (const request of incoming) {
            if (previous.has(request.friendshipId)) continue
            showToast({
              type: 'info',
              message: `${request.displayName ?? request.username} t’a envoyé une demande d’ami.`,
            })
          }
        }
        previousIncomingIdsRef.current = incomingIds
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

  // Rafraîchit la liste (donc le statut en direct de chaque ami) dès qu'un évènement
  // Realtime arrive sur live_status — voir useFriendsRealtime pour la reconnexion et le
  // repli par interrogation (règles transversales du Mode Amis).
  useFriendsRealtime(refresh, status === 'authenticated')
  // Nouvelles demandes (reçues ou envoyées) en temps réel (LOT H1), plus de rechargement
  // manuel nécessaire pour les voir apparaître.
  useFriendshipsRealtime(refresh, status === 'authenticated')

  const withFeedback = useCallback(
    async (action: () => Promise<void>, successMessage?: string) => {
      try {
        await action()
        if (successMessage) showToast({ type: 'success', message: successMessage })
        await refresh()
        return true
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return false
      }
    },
    [refresh, showToast],
  )

  const addByCode = useCallback(
    (code: string) => withFeedback(() => sendFriendRequest({ code }), 'Demande envoyée.'),
    [withFeedback],
  )
  const addByUsername = useCallback(
    (username: string) => withFeedback(() => sendFriendRequest({ username }), 'Demande envoyée.'),
    [withFeedback],
  )
  const preview = useCallback(
    (query: { code: string } | { username: string }): Promise<FriendProfilePreview | null> =>
      findProfilePreview(query),
    [],
  )
  const acceptRequest = useCallback(
    (friendshipId: string) => withFeedback(() => respondFriendRequest(friendshipId, true), 'Demande acceptée.'),
    [withFeedback],
  )
  const declineRequest = useCallback(
    (friendshipId: string) => withFeedback(() => respondFriendRequest(friendshipId, false)),
    [withFeedback],
  )
  const cancelRequest = useCallback(
    (friendshipId: string) => withFeedback(() => cancelFriendRequest(friendshipId)),
    [withFeedback],
  )
  const unfriend = useCallback(
    (otherUserId: string) => withFeedback(() => removeFriend(otherUserId), 'Ami retiré.'),
    [withFeedback],
  )
  const block = useCallback(
    (otherUserId: string) => withFeedback(() => blockUser(otherUserId), 'Compte bloqué.'),
    [withFeedback],
  )
  const unblock = useCallback(
    (otherUserId: string) => withFeedback(() => unblockUser(otherUserId), 'Compte débloqué.'),
    [withFeedback],
  )
  const report = useCallback(
    (targetUserId: string, reason: string) =>
      withFeedback(() => reportUser(targetUserId, reason), 'Signalement envoyé.'),
    [withFeedback],
  )
  const cheer = useCallback(
    async (otherUserId: string, emoji: CheerEmoji): Promise<boolean> => {
      try {
        await sendCheer(otherUserId, emoji)
        showToast({ type: 'success', message: 'Encouragement envoyé.' })
        return true
      } catch (err) {
        showToast({ type: 'error', message: errorMessage(err) })
        return false
      }
    },
    [showToast],
  )
  const regenerateCode = useCallback(async (): Promise<string | null> => {
    try {
      const code = await regenerateFriendCode()
      showToast({ type: 'success', message: 'Nouveau code ami généré.' })
      return code
    } catch (err) {
      showToast({ type: 'error', message: errorMessage(err) })
      return null
    }
  }, [showToast])

  const incomingRequests = requests.filter((r) => r.direction === 'incoming')
  const outgoingRequests = requests.filter((r) => r.direction === 'outgoing')

  return {
    friends,
    incomingRequests,
    outgoingRequests,
    isLoading,
    loadError,
    refresh,
    addByCode,
    addByUsername,
    preview,
    acceptRequest,
    declineRequest,
    cancelRequest,
    unfriend,
    block,
    unblock,
    report,
    cheer,
    regenerateCode,
  }
}
