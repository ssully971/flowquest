import type { MyRoom } from './types'

const STATUS_RANK = { running: 0, paused: 1, lobby: 2, ended: 3 } as const

/** Salon dont l'horloge prend la place de l'horloge solo (LOT M3) : parmi les salons que
 * j'ai REJOINTS et qui ne sont pas terminés, celui qui tourne d'abord, puis en pause, puis
 * en attente ; à égalité le plus récent. Une simple invitation (pas encore acceptée) ne
 * prend jamais la place de l'horloge. */
export function pickActiveRoom(rooms: MyRoom[]): MyRoom | null {
  const candidates = rooms.filter((room) => room.myStatus === 'joined' && room.status !== 'ended')
  candidates.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  return candidates[0] ?? null
}
