import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useToast } from '@/shared/toast'

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
  sendFriendRequest,
  unblockUser,
} from './friends-repository'
import type { Friend, FriendProfilePreview, FriendRequest } from './types'

function errorMessage(err: unknown): string {
  return err instanceof FriendsError ? err.message : 'Une erreur est survenue. Réessaie.'
}

/**
 * Charge et tient à jour amis + demandes (LOT F1). Pas d'abonnement Realtime ici — les
 * mises à jour en direct (statut, invitations instantanées) arrivent en LOT F2 ; pour
 * l'instant chaque action locale déclenche un rechargement explicite, suffisant pour une
 * page qu'on ouvre ponctuellement.
 */
export function useFriends() {
  const { status } = useAuth()
  const { showToast } = useToast()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

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
    regenerateCode,
  }
}
