import { beforeEach, describe, expect, it } from 'vitest'
import { vi } from 'vitest'

const rpcMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}))

describe('rooms-repository — appels RPC et mise en forme (LOT F3)', () => {
  beforeEach(() => {
    rpcMock.mockReset()
  })

  it('listMyRooms appelle list_my_rooms et met les colonnes en camelCase', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          room_id: 'r1',
          host_id: 'u1',
          host_username: 'hote',
          host_display_name: 'Hôte',
          status: 'lobby',
          focus_minutes: 25,
          my_status: 'invited',
          participant_count: 2,
          created_at: '2026-01-01T00:00:00Z',
          mode: 'countdown',
          phase: 'focus',
          started_at: null,
          duration_ms: null,
          elapsed_ms_at_pause: null,
        },
      ],
      error: null,
    })
    const { listMyRooms } = await import('./rooms-repository')

    const result = await listMyRooms()

    expect(rpcMock).toHaveBeenCalledWith('list_my_rooms')
    expect(result).toEqual([
      {
        roomId: 'r1',
        hostId: 'u1',
        hostUsername: 'hote',
        hostDisplayName: 'Hôte',
        status: 'lobby',
        focusMinutes: 25,
        myStatus: 'invited',
        participantCount: 2,
        createdAt: '2026-01-01T00:00:00Z',
        mode: 'countdown',
        phase: 'focus',
        startedAt: null,
        durationMs: null,
        elapsedMsAtPause: null,
      },
    ])
  })

  it('createRoom envoie la durée et les amis invités, renvoie l’id du salon', async () => {
    rpcMock.mockResolvedValue({ data: 'new-room-id', error: null })
    const { createRoom } = await import('./rooms-repository')

    const result = await createRoom({ mode: 'countdown', focusMinutes: 25, friendIds: ['f1', 'f2'] })

    expect(rpcMock).toHaveBeenCalledWith('create_room', {
      p_focus_minutes: 25,
      p_friend_ids: ['f1', 'f2'],
      p_mode: 'countdown',
      p_pillar_id: null,
    })
    expect(result).toBe('new-room-id')
  })

  it('createRoom Pomodoro transmet les durées de pauses et le pilier', async () => {
    rpcMock.mockResolvedValue({ data: 'id', error: null })
    const { createRoom } = await import('./rooms-repository')

    await createRoom({
      mode: 'pomodoro',
      focusMinutes: 50,
      shortBreakMinutes: 10,
      longBreakMinutes: 30,
      sessionsBeforeLongBreak: 3,
      friendIds: ['f1'],
      pillarId: 'p1',
    })

    expect(rpcMock).toHaveBeenCalledWith('create_room', {
      p_focus_minutes: 50,
      p_friend_ids: ['f1'],
      p_mode: 'pomodoro',
      p_short_break_minutes: 10,
      p_long_break_minutes: 30,
      p_sessions_before_long_break: 3,
      p_pillar_id: 'p1',
    })
  })

  it('createRoom Chrono n’envoie aucune durée', async () => {
    rpcMock.mockResolvedValue({ data: 'id', error: null })
    const { createRoom } = await import('./rooms-repository')

    await createRoom({ mode: 'stopwatch', focusMinutes: 25, friendIds: ['f1'] })

    expect(rpcMock).toHaveBeenCalledWith(
      'create_room',
      expect.objectContaining({ p_mode: 'stopwatch', p_focus_minutes: null }),
    )
  })

  it('getRoomState mesure l’écart d’horloge appareil − serveur', async () => {
    const serverNow = new Date('2026-01-01T12:00:00Z').getTime()
    rpcMock.mockResolvedValue({
      data: [
        {
          room_id: 'r1', host_id: 'h', status: 'running', focus_minutes: 25,
          started_at: '2026-01-01T11:50:00Z', duration_ms: 1_500_000, elapsed_ms_at_pause: null,
          created_at: 'x', ended_at: null, participant_user_id: 'h', participant_username: 'h',
          participant_display_name: null, participant_avatar_url: null, participant_avatar_version: 0,
          participant_role: 'host', participant_status: 'joined', participant_is_present: true,
          mode: 'pomodoro', phase: 'focus', phase_index: 2, short_break_minutes: 5,
          long_break_minutes: 15, sessions_before_long_break: 4, server_now: '2026-01-01T12:00:00Z',
        },
      ],
      error: null,
    })
    const { getRoomState } = await import('./rooms-repository')
    vi.useFakeTimers()
    vi.setSystemTime(serverNow + 7_000) // l'appareil avance de 7 s
    const state = await getRoomState('r1')
    vi.useRealTimers()

    expect(state?.clockOffsetMs).toBe(7_000)
    expect(state).toMatchObject({ mode: 'pomodoro', phase: 'focus', phaseIndex: 2, sessionsBeforeLongBreak: 4 })
  })

  it('respondRoomInvite transmet p_accept', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { respondRoomInvite } = await import('./rooms-repository')

    await respondRoomInvite('r1', true)

    expect(rpcMock).toHaveBeenCalledWith('respond_room_invite', {
      p_room_id: 'r1',
      p_accept: true,
      p_pillar_id: null,
    })
  })

  it('getRoomState assemble les lignes participant en un seul état de salon', async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          room_id: 'r1',
          host_id: 'u1',
          status: 'running',
          focus_minutes: 25,
          started_at: '2026-01-01T10:00:00Z',
          duration_ms: 1500000,
          elapsed_ms_at_pause: null,
          created_at: '2026-01-01T09:00:00Z',
          ended_at: null,
          participant_user_id: 'u1',
          participant_username: 'hote',
          participant_display_name: 'Hôte',
          participant_avatar_url: null,
          participant_avatar_version: 0,
          participant_role: 'host',
          participant_status: 'joined',
          participant_is_present: true,
          mode: 'pomodoro',
          phase: 'focus',
          phase_index: 2,
          short_break_minutes: 5,
          long_break_minutes: 15,
          sessions_before_long_break: 4,
          server_now: '2026-01-01T10:05:00Z',
        },
        {
          room_id: 'r1',
          host_id: 'u1',
          status: 'running',
          focus_minutes: 25,
          started_at: '2026-01-01T10:00:00Z',
          duration_ms: 1500000,
          elapsed_ms_at_pause: null,
          created_at: '2026-01-01T09:00:00Z',
          ended_at: null,
          participant_user_id: 'u2',
          participant_username: 'invite',
          participant_display_name: null,
          participant_avatar_url: null,
          participant_avatar_version: 0,
          participant_role: 'member',
          participant_status: 'joined',
          participant_is_present: false,
          mode: 'pomodoro',
          phase: 'focus',
          phase_index: 2,
          short_break_minutes: 5,
          long_break_minutes: 15,
          sessions_before_long_break: 4,
          server_now: '2026-01-01T10:05:00Z',
        },
      ],
      error: null,
    })
    const { getRoomState } = await import('./rooms-repository')

    const result = await getRoomState('r1')

    expect(rpcMock).toHaveBeenCalledWith('get_room_state', { p_room_id: 'r1' })
    expect(result).toMatchObject({
      roomId: 'r1',
      hostId: 'u1',
      status: 'running',
      focusMinutes: 25,
      mode: 'pomodoro',
      phase: 'focus',
      phaseIndex: 2,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      sessionsBeforeLongBreak: 4,
      startedAt: '2026-01-01T10:00:00Z',
      durationMs: 1500000,
      elapsedMsAtPause: null,
      createdAt: '2026-01-01T09:00:00Z',
      endedAt: null,
      participants: [
        {
          userId: 'u1',
          username: 'hote',
          displayName: 'Hôte',
          avatarUrl: null,
          avatarVersion: 0,
          role: 'host',
          status: 'joined',
          isPresent: true,
        },
        {
          userId: 'u2',
          username: 'invite',
          displayName: null,
          avatarUrl: null,
          avatarVersion: 0,
          role: 'member',
          status: 'joined',
          isPresent: false,
        },
      ],
    })
  })

  it('getRoomState renvoie null quand le salon n’a plus aucune ligne (inaccessible)', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { getRoomState } = await import('./rooms-repository')

    expect(await getRoomState('r1')).toBeNull()
  })

  it.each([
    ['startRoom', 'start_room'],
    ['pauseRoom', 'pause_room'],
    ['resumeRoom', 'resume_room'],
    ['endRoom', 'end_room'],
    ['leaveRoom', 'leave_room'],
  ] as const)('%s appelle %s avec p_room_id', async (exportName, rpcName) => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const repository = await import('./rooms-repository')
    const fn = repository[exportName] as (roomId: string) => Promise<void>

    await fn('r1')

    expect(rpcMock).toHaveBeenCalledWith(rpcName, { p_room_id: 'r1' })
  })

  it('transferHost transmet le nouvel hôte', async () => {
    rpcMock.mockResolvedValue({ data: null, error: null })
    const { transferHost } = await import('./rooms-repository')

    await transferHost('r1', 'u2')

    expect(rpcMock).toHaveBeenCalledWith('transfer_host', { p_room_id: 'r1', p_new_host_id: 'u2' })
  })

  it('propage un message d’erreur RPC traduit', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'Le salon a déjà démarré' } })
    const { RoomsError, startRoom } = await import('./rooms-repository')

    await expect(startRoom('r1')).rejects.toThrow(RoomsError)
    await expect(startRoom('r1')).rejects.toThrow('Le salon a déjà démarré')
  })
})
