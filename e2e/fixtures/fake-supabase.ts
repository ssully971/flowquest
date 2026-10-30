import type { Page } from '@playwright/test'

/**
 * Faux « serveur » Supabase partagé en mémoire, pour le test à deux contextes de
 * navigateur des salons de focus (LOT F3). Pas de projet Supabase réel accessible depuis
 * cet environnement : chaque contexte de navigateur intercepte ses propres requêtes
 * réseau (`page.route`), mais les deux dispatchent vers la MÊME instance de ce faux
 * serveur (créée une fois par test, fermée sur le processus Node du test, pas dans le
 * navigateur) — ce qui permet à un vrai navigateur B de voir l'effet d'une action faite
 * dans un vrai navigateur A, exactement comme le ferait un vrai backend partagé.
 *
 * Ce n'est volontairement pas une réimplémentation complète des migrations SQL (pas de
 * minuterie d'abandon à 2 minutes, par exemple — bien trop lent pour un test) : juste
 * assez de logique métier (gating hôte, transitions d'état, transfert immédiat au départ
 * de l'hôte) pour que le scénario testé soit représentatif.
 */

export interface FakeProfile {
  id: string
  username: string
  display_name: string | null
}

export const HOST: FakeProfile = { id: '11111111-1111-1111-1111-111111111111', username: 'hote', display_name: 'Hôte' }
export const MEMBER: FakeProfile = { id: '22222222-2222-2222-2222-222222222222', username: 'membre', display_name: null }

const PROFILES: Record<string, FakeProfile> = { [HOST.id]: HOST, [MEMBER.id]: MEMBER }

interface FakeRoom {
  id: string
  hostId: string
  status: 'lobby' | 'running' | 'paused' | 'ended'
  focusMinutes: number
  mode: 'pomodoro' | 'countdown' | 'stopwatch'
  startedAt: string | null
  durationMs: number | null
  elapsedMsAtPause: number | null
  createdAt: string
  endedAt: string | null
}

interface FakeParticipant {
  roomId: string
  userId: string
  role: 'host' | 'member'
  status: 'invited' | 'joined' | 'declined' | 'left'
  joinedAt: string | null
}

export interface FakeCall {
  userId: string
  fn: string
  at: number
}

export interface FakeBackend {
  handleRpc: (userId: string, fn: string, params: Record<string, unknown>) => unknown
  /** Journal de toutes les RPC reçues (pour vérifier qu'aucune requête ne part en continu). */
  calls: FakeCall[]
  /** Latence simulée de chaque RPC (ms) : permet de voir le retour visuel pendant l'attente. */
  setLatency: (ms: number) => void
  latencyMs: () => number
  /** La prochaine RPC `fn` échoue avec ce message (ex. 'Failed to fetch') puis tout redevient normal. */
  failNext: (fn: string, message?: string) => void
}

export function createFakeBackend(): FakeBackend {
  const calls: FakeCall[] = []
  let latency = 0
  const failures = new Map<string, string>()
  const rooms = new Map<string, FakeRoom>()
  const participants = new Map<string, FakeParticipant>()
  let nextId = 1
  const newId = (prefix: string) => `${prefix}-${nextId++}`
  const key = (roomId: string, userId: string) => `${roomId}:${userId}`
  const participantsOf = (roomId: string) => [...participants.values()].filter((p) => p.roomId === roomId)

  function requireRoom(roomId: string): FakeRoom {
    const room = rooms.get(roomId)
    if (!room) throw new Error('Salon introuvable')
    return room
  }

  function requireHost(userId: string, room: FakeRoom) {
    if (room.hostId !== userId) throw new Error('Seul l’hôte peut faire cela')
  }

  function maybeTransferHostOnDeparture(room: FakeRoom, departingUserId: string) {
    if (room.status === 'ended' || room.hostId !== departingUserId) return
    const next = participantsOf(room.id)
      .filter((p) => p.status === 'joined')
      .sort((a, b) => (a.joinedAt ?? '').localeCompare(b.joinedAt ?? ''))[0]
    if (next) {
      room.hostId = next.userId
      next.role = 'host'
      const old = participants.get(key(room.id, departingUserId))
      if (old) old.role = 'member'
    } else {
      room.status = 'ended'
      room.endedAt = new Date().toISOString()
    }
  }

  function roomStateRows(roomId: string) {
    const room = requireRoom(roomId)
    return participantsOf(roomId).map((p) => {
      const profile = PROFILES[p.userId]
      return {
        room_id: room.id,
        host_id: room.hostId,
        status: room.status,
        focus_minutes: room.focusMinutes,
        mode: room.mode,
        phase: 'focus',
        phase_index: 0,
        short_break_minutes: 5,
        long_break_minutes: 15,
        sessions_before_long_break: 4,
        server_now: new Date().toISOString(),
        room_updated_at: new Date().toISOString(),
        started_at: room.startedAt,
        duration_ms: room.durationMs,
        elapsed_ms_at_pause: room.elapsedMsAtPause,
        created_at: room.createdAt,
        ended_at: room.endedAt,
        participant_user_id: p.userId,
        participant_username: profile.username,
        participant_display_name: profile.display_name,
        participant_avatar_url: null,
        participant_avatar_version: 0,
        participant_role: p.role,
        participant_status: p.status,
        participant_is_present: p.status === 'joined',
      }
    })
  }

  const handlers: Record<string, (userId: string, params: Record<string, unknown>) => unknown> = {
    create_room(userId, params) {
      const roomId = newId('room')
      const focusMinutes = Number(params.p_focus_minutes)
      const mode = (params.p_mode as 'pomodoro' | 'countdown' | 'stopwatch' | undefined) ?? 'countdown'
      rooms.set(roomId, {
        id: roomId,
        hostId: userId,
        status: 'lobby',
        focusMinutes,
        mode,
        startedAt: null,
        durationMs: null,
        elapsedMsAtPause: null,
        createdAt: new Date().toISOString(),
        endedAt: null,
      })
      participants.set(key(roomId, userId), { roomId, userId, role: 'host', status: 'joined', joinedAt: new Date().toISOString() })
      const friendIds = (params.p_friend_ids as string[]) ?? []
      for (const friendId of friendIds) {
        if (friendId === userId) continue
        participants.set(key(roomId, friendId), { roomId, userId: friendId, role: 'member', status: 'invited', joinedAt: null })
      }
      return roomId
    },
    respond_room_invite(userId, params) {
      const roomId = params.p_room_id as string
      const p = participants.get(key(roomId, userId))
      if (!p || p.status !== 'invited') throw new Error('Invitation introuvable')
      p.status = params.p_accept ? 'joined' : 'declined'
      if (params.p_accept) p.joinedAt = new Date().toISOString()
      return null
    },
    start_room(userId, params) {
      const room = requireRoom(params.p_room_id as string)
      requireHost(userId, room)
      // Idempotent comme la migration 0050 : un double clic ne lève jamais d'erreur.
      if (room.status !== 'lobby') return null
      room.status = 'running'
      room.startedAt = new Date().toISOString()
      room.durationMs = room.mode === 'stopwatch' ? null : room.focusMinutes * 60_000
      return null
    },
    pause_room(userId, params) {
      const room = requireRoom(params.p_room_id as string)
      requireHost(userId, room)
      if (room.status !== 'running') return null
      room.elapsedMsAtPause = Date.now() - new Date(room.startedAt!).getTime()
      room.status = 'paused'
      return null
    },
    resume_room(userId, params) {
      const room = requireRoom(params.p_room_id as string)
      requireHost(userId, room)
      if (room.status !== 'paused') return null
      room.startedAt = new Date(Date.now() - (room.elapsedMsAtPause ?? 0)).toISOString()
      room.elapsedMsAtPause = null
      room.status = 'running'
      return null
    },
    end_room(userId, params) {
      const room = requireRoom(params.p_room_id as string)
      if (room.status === 'ended') return null
      requireHost(userId, room)
      room.status = 'ended'
      room.endedAt = new Date().toISOString()
      return null
    },
    leave_room(userId, params) {
      const roomId = params.p_room_id as string
      const p = participants.get(key(roomId, userId))
      if (p && p.status === 'joined') p.status = 'left'
      const room = rooms.get(roomId)
      if (room) maybeTransferHostOnDeparture(room, userId)
      return null
    },
    transfer_host(userId, params) {
      const room = requireRoom(params.p_room_id as string)
      requireHost(userId, room)
      const newHostId = params.p_new_host_id as string
      const newHostP = participants.get(key(room.id, newHostId))
      if (!newHostP || newHostP.status !== 'joined') throw new Error('Cette personne n’est pas dans le salon')
      const oldHostP = participants.get(key(room.id, userId))
      room.hostId = newHostId
      newHostP.role = 'host'
      if (oldHostP) oldHostP.role = 'member'
      return null
    },
    list_my_rooms(userId) {
      return [...participants.values()]
        .filter((p) => p.userId === userId && (p.status === 'invited' || p.status === 'joined'))
        .map((p) => {
          const room = requireRoom(p.roomId)
          if (room.status === 'ended') return null
          const host = PROFILES[room.hostId]
          return {
            room_id: room.id,
            host_id: room.hostId,
            host_username: host.username,
            host_display_name: host.display_name,
            status: room.status,
            focus_minutes: room.focusMinutes,
            my_status: p.status,
            participant_count: participantsOf(room.id).filter((x) => x.status === 'joined').length,
            created_at: room.createdAt,
            mode: room.mode,
            phase: 'focus',
            started_at: room.startedAt,
            duration_ms: room.durationMs,
            elapsed_ms_at_pause: room.elapsedMsAtPause,
          }
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
    },
    get_room_state(userId, params) {
      const roomId = params.p_room_id as string
      const mine = participants.get(key(roomId, userId))
      if (!mine) throw new Error('Salon introuvable')
      return roomStateRows(roomId)
    },
    list_friends(userId) {
      return Object.values(PROFILES)
        .filter((p) => p.id !== userId)
        .map((p) => ({
          friendship_id: `f-${p.id}`,
          id: p.id,
          username: p.username,
          display_name: p.display_name,
          avatar_url: null,
          avatar_version: 0,
          since: new Date().toISOString(),
          live_state: null,
          live_started_at: null,
          live_duration_ms: null,
          live_is_online: false,
        }))
    },
  }

  return {
    calls,
    setLatency(ms) {
      latency = ms
    },
    latencyMs: () => latency,
    failNext(fn, message = 'Failed to fetch') {
      failures.set(fn, message)
    },
    handleRpc(userId, fn, params) {
      calls.push({ userId, fn, at: Date.now() })
      const failure = failures.get(fn)
      if (failure !== undefined) {
        failures.delete(fn)
        throw new Error(failure)
      }
      const handler = handlers[fn]
      if (!handler) return []
      return handler(userId, params)
    },
  }
}

const FAKE_PROJECT_HOST = 'fake-project.supabase.co'

function buildSession(profile: FakeProfile) {
  return {
    access_token: 'fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: profile.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${profile.username}@example.com`,
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}

function profileRow(profile: FakeProfile) {
  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: null,
    role: 'user',
    timezone: 'America/Guadeloupe',
    stats_visibility: 'private',
    banned_at: null,
    friend_code: profile.id.slice(0, 8).toUpperCase(),
    avatar_version: 0,
    invisible_mode: false,
    show_live_status: true,
    show_total_time_score: true,
    participate_leaderboard: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

/** Authentifie une page de test comme `profile` et branche ses requêtes réseau sur le
 * faux serveur partagé `backend` — à appeler avant toute navigation (`page.goto`). */
export async function signInAs(page: Page, backend: FakeBackend, profile: FakeProfile): Promise<void> {
  await page.addInitScript(
    ({ host, session }) => {
      window.localStorage.setItem(`sb-${host.split('.')[0]}-auth-token`, JSON.stringify(session))
    },
    { host: FAKE_PROJECT_HOST, session: buildSession(profile) },
  )

  // Repli générique d'abord (dernier `page.route` enregistré gagne en Playwright) : les
  // tables non concernées par ce test (tasks, notes, user_settings...) renvoient une
  // liste vide, suffisant pour qu'AppShell se monte sans erreur.
  await page.route('**/rest/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/rest/v1/rpc/**', async (route) => {
    const fn = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    const params = (route.request().postDataJSON() as Record<string, unknown>) ?? {}
    try {
      if (backend.latencyMs() > 0) await new Promise((resolve) => setTimeout(resolve, backend.latencyMs()))
      const data = backend.handleRpc(profile.id, fn, params)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data ?? null) })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue'
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message }) })
    }
  })
  await page.route('**/rest/v1/profiles**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(profileRow(profile)) }),
  )
  await page.route('**/auth/v1/user**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  )
  await page.route('**/realtime/v1/**', (route) => route.abort())
}
