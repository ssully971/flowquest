// Types écrits à la main pour correspondre aux migrations dans supabase/migrations.
// En l'absence d'un projet Supabase en ligne accessible depuis cet environnement, ils ne
// sont pas générés par `supabase gen types`. Si tu lances la génération depuis ton projet,
// ce fichier peut être remplacé par la sortie officielle sans rien casser côté appel.

export type UserRole = 'user' | 'admin'
export type StatsVisibility = 'public' | 'hidden'
export type SessionKind = 'focus' | 'short_break' | 'long_break'
export type TimerMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type TimerSegment = 'focus' | 'short_break' | 'long_break' | 'countdown' | 'stopwatch'
export type TimerStatus = 'idle' | 'running' | 'paused' | 'completed'
export type SupportMessageStatus = 'pending' | 'processed'
export type SupportMessageCategory = 'contact' | 'report'
export type FriendshipStatus = 'pending' | 'accepted' | 'blocked'
export type FriendRequestDirection = 'incoming' | 'outgoing'
export type LiveState = 'focus' | 'pause' | 'inactive'
export type CheerEmoji = '💪' | '🔥' | '👏' | '❤️' | '☕'
export type RoomStatus = 'lobby' | 'running' | 'paused' | 'ended'
export type RoomMode = 'pomodoro' | 'countdown' | 'stopwatch'
export type RoomPhase = 'focus' | 'short_break' | 'long_break'
export type RoomParticipantRole = 'host' | 'member'
export type RoomParticipantStatus = 'invited' | 'joined' | 'declined' | 'left' | 'abandoned'

export type InviteCodeType = 'admin' | 'user'
export type InviteCodeStatus = 'active' | 'used' | 'expired'

export interface InviteCodeIssued {
  code: string
  expires_at: string
}

export interface InviteEligibilityRow {
  focus_seconds: number
  focus_required_seconds: number
  account_age_days: number
  account_age_required_days: number
  codes_this_month: number
  codes_monthly_limit: number
  next_reset_at: string
}

export interface MyInviteCodeRow {
  id: string
  code: string
  created_at: string
  expires_at: string | null
  is_used: boolean
  used_at: string | null
  used_by_username: string | null
  status: InviteCodeStatus
}

export interface AdminInviteCodeRow extends MyInviteCodeRow {
  type: InviteCodeType
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          avatar_url: string | null
          role: UserRole
          timezone: string
          stats_visibility: StatsVisibility
          banned_at: string | null
          suspended_until: string | null
          friend_code: string
          avatar_version: number
          invisible_mode: boolean
          show_live_status: boolean
          show_total_time_score: boolean
          participate_leaderboard: boolean
          marketing_consent: boolean
          marketing_consent_at: string | null
          /** false = compte créé via Google en attente de code d'invitation (bêta fermée,
           * 0047_invite_codes.sql) ; jamais modifiable côté client. */
          invite_ok: boolean
          last_active_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          avatar_url?: string | null
          timezone?: string
          stats_visibility?: StatsVisibility
          marketing_consent?: boolean
          marketing_consent_at?: string | null
        }
        Update: {
          username?: string
          display_name?: string | null
          avatar_url?: string | null
          timezone?: string
          stats_visibility?: StatsVisibility
          friend_code?: string
          invisible_mode?: boolean
          show_live_status?: boolean
          show_total_time_score?: boolean
          participate_leaderboard?: boolean
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          last_active_at?: string | null
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          id: string
          code: string
          created_by: string
          type: InviteCodeType
          is_used: boolean
          used_by: string | null
          used_at: string | null
          expires_at: string | null
          created_at: string
        }
        // Aucune politique INSERT/UPDATE/DELETE : tout passe par les RPC SECURITY DEFINER
        // (admin_generate_invite_code, user_generate_invite_code, consume_invite_code...).
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      feature_flags: {
        Row: {
          key: string
          enabled: boolean
          label: string
          description: string
          updated_by: string | null
          updated_at: string
        }
        // Aucune politique RLS INSERT/UPDATE/DELETE : toute mutation passe par la RPC
        // admin_set_feature_flag(), jamais une écriture directe côté client.
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      friendships: {
        Row: {
          id: string
          requester_id: string
          addressee_id: string
          status: FriendshipStatus
          blocked_by: string | null
          created_at: string
          updated_at: string
        }
        // Aucune politique RLS INSERT/UPDATE/DELETE : toute mutation passe par les RPC
        // dédiées (send_friend_request, respond_friend_request...), jamais une écriture
        // directe côté client.
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      live_status: {
        Row: {
          user_id: string
          state: LiveState
          started_at: string | null
          duration_ms: number | null
          updated_at: string
        }
        Insert: {
          user_id: string
          state?: LiveState
          started_at?: string | null
          duration_ms?: number | null
        }
        Update: {
          state?: LiveState
          started_at?: string | null
          duration_ms?: number | null
        }
        Relationships: []
      }
      cheers: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          emoji: CheerEmoji
          read_at: string | null
          created_at: string
        }
        // Aucune politique RLS INSERT/UPDATE/DELETE : toute mutation passe par
        // send_cheer()/mark_cheers_read().
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      rooms: {
        Row: {
          id: string
          host_id: string
          status: RoomStatus
          /** null en mode Chrono (aucune durée) ; 5-120 sinon. */
          focus_minutes: number | null
          mode: RoomMode
          short_break_minutes: number | null
          long_break_minutes: number | null
          sessions_before_long_break: number | null
          /** Phase courante (toujours 'focus' en Chrono et Minuteur) et son numéro. */
          phase: RoomPhase
          phase_index: number
          started_at: string | null
          duration_ms: number | null
          elapsed_ms_at_pause: number | null
          created_at: string
          updated_at: string
          ended_at: string | null
        }
        // Aucune politique RLS INSERT/UPDATE/DELETE : toute mutation passe par les RPC
        // dédiées (create_room, start_room, pause_room...), jamais une écriture directe
        // côté client.
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      room_participants: {
        Row: {
          room_id: string
          user_id: string
          role: RoomParticipantRole
          status: RoomParticipantStatus
          joined_at: string | null
          left_at: string | null
          last_seen_at: string | null
          created_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      duo_streaks: {
        Row: {
          user_low: string
          user_high: string
          current_streak: number
          longest_streak: number
          last_active_date: string | null
          updated_at: string
        }
        // Aucune politique RLS INSERT/UPDATE/DELETE : entretenue exclusivement par le
        // trigger bump_duo_streaks() et par le reset paresseux de list_duo_streaks().
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      user_settings: {
        Row: {
          user_id: string
          schema_version: number
          settings: Record<string, unknown>
          updated_at: string
        }
        Insert: {
          user_id: string
          schema_version?: number
          settings: Record<string, unknown>
          updated_at: string
        }
        Update: {
          schema_version?: number
          settings?: Record<string, unknown>
          updated_at: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          user_id: string
          title: string
          emoji: string | null
          color: string | null
          eta_minutes: number | null
          parent_id: string | null
          position: number
          done: boolean
          done_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          emoji?: string | null
          color?: string | null
          eta_minutes?: number | null
          parent_id?: string | null
          position?: number
          done?: boolean
          done_at?: string | null
        }
        Update: {
          title?: string
          emoji?: string | null
          color?: string | null
          eta_minutes?: number | null
          parent_id?: string | null
          position?: number
          done?: boolean
          done_at?: string | null
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          id: string
          user_id: string
          kind: SessionKind
          planned_seconds: number
          actual_seconds: number
          started_at: string
          ended_at: string | null
          completed: boolean
          task_id: string | null
          pillar_id: string | null
          group_session_id: string | null
          xp_multiplier: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          kind: SessionKind
          planned_seconds: number
          actual_seconds?: number
          started_at: string
          ended_at?: string | null
          completed?: boolean
          task_id?: string | null
          pillar_id?: string | null
          group_session_id?: string | null
        }
        Update: {
          actual_seconds?: number
          ended_at?: string | null
          completed?: boolean
        }
        Relationships: []
      }
      pillars: {
        Row: {
          id: string
          user_id: string
          name: string
          color: string
          current_xp: number
          level: number
          created_at: string
          archived_at: string | null
          goal_level: number | null
          goal_deadline: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          color: string
          archived_at?: string | null
          goal_level?: number | null
          goal_deadline?: string | null
        }
        Update: {
          name?: string
          color?: string
          archived_at?: string | null
          goal_level?: number | null
          goal_deadline?: string | null
        }
        Relationships: []
      }
      timer_state: {
        Row: {
          user_id: string
          mode: TimerMode
          segment: TimerSegment
          status: TimerStatus
          started_at: string | null
          paused_at: string | null
          duration_ms: number | null
          paused_total_ms: number
          task_id: string | null
          updated_at: string
        }
        Insert: {
          user_id: string
          mode: TimerMode
          segment: TimerSegment
          status: TimerStatus
          started_at?: string | null
          paused_at?: string | null
          duration_ms?: number | null
          paused_total_ms?: number
          task_id?: string | null
          updated_at: string
        }
        Update: {
          mode?: TimerMode
          segment?: TimerSegment
          status?: TimerStatus
          started_at?: string | null
          paused_at?: string | null
          duration_ms?: number | null
          paused_total_ms?: number
          task_id?: string | null
          updated_at: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          user_id: string
          content: string
          updated_at: string
        }
        Insert: {
          user_id: string
          content: string
          updated_at: string
        }
        Update: {
          content?: string
          updated_at: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          id: string
          user_id: string | null
          email: string
          body: string
          status: SupportMessageStatus
          category: SupportMessageCategory
          reported_user_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          email: string
          body: string
          status?: SupportMessageStatus
          category?: SupportMessageCategory
          reported_user_id?: string | null
        }
        Update: {
          status?: SupportMessageStatus
        }
        Relationships: []
      }
      admin_log: {
        Row: {
          id: string
          admin_id: string | null
          action: string
          target: string
          created_at: string
        }
        Insert: {
          id?: string
          admin_id?: string | null
          action: string
          target: string
        }
        Update: Record<string, never>
        Relationships: []
      }
      quotes: {
        Row: {
          id: string
          text: string
          author: string | null
          category: string | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          text: string
          author?: string | null
          category?: string | null
          active?: boolean
        }
        Update: {
          text?: string
          author?: string | null
          category?: string | null
          active?: boolean
        }
        Relationships: []
      }
      changelog: {
        Row: {
          id: string
          version: string
          released_at: string
          body: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          version: string
          released_at: string
          body: string
          active?: boolean
        }
        Update: {
          version?: string
          released_at?: string
          body?: string
          active?: boolean
        }
        Relationships: []
      }
      game_campaigns: {
        Row: {
          id: string
          name: string
          xp_multiplier: number
          starts_at: string
          ends_at: string
          active: boolean
          created_by: string | null
          created_at: string
        }
        // Aucune politique RLS directe : lecture via current_game_campaign() (bandeau),
        // gestion via les RPC admin_start_campaign()/admin_stop_campaign().
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
      xp_grants: {
        Row: {
          id: string
          target_user_id: string
          pillar_id: string
          amount: number
          reason: string
          granted_by: string | null
          created_at: string
          seen_at: string | null
        }
        // Lecture (xp_grants_select_own) permise au bénéficiaire ; écriture uniquement
        // via admin_grant_xp()/acknowledge_xp_grant().
        Insert: Record<string, never>
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: {
        Args: { uid?: string }
        Returns: boolean
      }
      ensure_profile: {
        Args: Record<string, never>
        Returns: Database['public']['Tables']['profiles']['Row']
      }
      is_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      delete_own_account: {
        Args: Record<string, never>
        Returns: undefined
      }
      is_banned: {
        Args: { uid?: string }
        Returns: boolean
      }
      admin_ban_user: {
        Args: { p_target_user_id: string; p_reason?: string | null }
        Returns: undefined
      }
      admin_unban_user: {
        Args: { p_target_user_id: string }
        Returns: undefined
      }
      regenerate_friend_code: {
        Args: Record<string, never>
        Returns: string
      }
      send_friend_request: {
        Args: { p_code?: string | null; p_username?: string | null }
        Returns: Database['public']['Tables']['friendships']['Row']
      }
      respond_friend_request: {
        Args: { p_friendship_id: string; p_accept: boolean }
        Returns: undefined
      }
      cancel_friend_request: {
        Args: { p_friendship_id: string }
        Returns: undefined
      }
      remove_friend: {
        Args: { p_other_user_id: string }
        Returns: undefined
      }
      block_user: {
        Args: { p_other_user_id: string }
        Returns: undefined
      }
      unblock_user: {
        Args: { p_other_user_id: string }
        Returns: undefined
      }
      find_profile_preview: {
        Args: { p_code?: string | null; p_username?: string | null }
        Returns: FriendProfilePreviewRow[]
      }
      list_friends: {
        Args: Record<string, never>
        Returns: FriendRow[]
      }
      list_friend_requests: {
        Args: Record<string, never>
        Returns: FriendRequestRow[]
      }
      report_user: {
        Args: { p_target_user_id: string; p_reason: string }
        Returns: undefined
      }
      admin_remove_avatar: {
        Args: { p_target_user_id: string }
        Returns: undefined
      }
      send_cheer: {
        Args: { p_recipient_id: string; p_emoji: string }
        Returns: undefined
      }
      list_unread_cheers: {
        Args: Record<string, never>
        Returns: UnreadCheerRow[]
      }
      mark_cheers_read: {
        Args: Record<string, never>
        Returns: undefined
      }
      weekly_leaderboard: {
        Args: { p_week_offset?: number }
        Returns: LeaderboardRow[]
      }
      create_room: {
        Args: {
          p_focus_minutes: number | null
          p_friend_ids: string[]
          p_mode?: RoomMode
          p_short_break_minutes?: number
          p_long_break_minutes?: number
          p_sessions_before_long_break?: number
          p_pillar_id?: string | null
        }
        Returns: string
      }
      respond_room_invite: {
        Args: { p_room_id: string; p_accept: boolean; p_pillar_id?: string | null }
        Returns: undefined
      }
      set_room_pillar: {
        Args: { p_room_id: string; p_pillar_id: string | null }
        Returns: undefined
      }
      start_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      pause_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      resume_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      end_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      transfer_host: {
        Args: { p_room_id: string; p_new_host_id: string }
        Returns: undefined
      }
      leave_room: {
        Args: { p_room_id: string }
        Returns: undefined
      }
      list_my_rooms: {
        Args: Record<string, never>
        Returns: MyRoomRow[]
      }
      get_room_state: {
        Args: { p_room_id: string }
        Returns: RoomStateRow[]
      }
      list_duo_streaks: {
        Args: Record<string, never>
        Returns: DuoStreakRow[]
      }
      is_feature_enabled: {
        Args: { flag_key: string }
        Returns: boolean
      }
      admin_set_feature_flag: {
        Args: { flag_key: string; new_enabled: boolean; new_description?: string | null }
        Returns: Database['public']['Tables']['feature_flags']['Row']
      }
      touch_activity: {
        Args: Record<string, never>
        Returns: undefined
      }
      admin_stats_overview: {
        Args: Record<string, never>
        Returns: AdminStatsOverview
      }
      admin_list_log: {
        Args: { p_limit?: number; p_search?: string | null }
        Returns: AdminLogRow[]
      }
      admin_list_users: {
        Args: { p_limit?: number; p_offset?: number; p_search?: string | null; p_sort?: string }
        Returns: AdminUserRow[]
      }
      admin_export_users: {
        Args: { p_only_consented?: boolean }
        Returns: AdminUserExportRow[]
      }
      admin_suspend_user: {
        Args: { p_target_user_id: string; p_duration_days: number; p_reason?: string | null }
        Returns: undefined
      }
      admin_unsuspend_user: {
        Args: { p_target_user_id: string }
        Returns: undefined
      }
      admin_user_stats: {
        Args: { p_target_user_id: string }
        Returns: AdminUserStats
      }
      admin_generate_invite_code: {
        Args: Record<string, never>
        Returns: InviteCodeIssued[]
      }
      admin_revoke_invite_code: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_list_invite_codes: {
        Args: { p_limit?: number }
        Returns: AdminInviteCodeRow[]
      }
      user_generate_invite_code: {
        Args: Record<string, never>
        Returns: InviteCodeIssued[]
      }
      get_invite_eligibility: {
        Args: Record<string, never>
        Returns: InviteEligibilityRow[]
      }
      list_my_invite_codes: {
        Args: Record<string, never>
        Returns: MyInviteCodeRow[]
      }
      check_invite_code: {
        Args: { p_code: string }
        Returns: boolean
      }
      consume_invite_code: {
        Args: { p_code: string }
        Returns: boolean
      }
      touch_my_rooms: {
        Args: Record<string, never>
        Returns: undefined
      }
      admin_delete_user: {
        Args: { p_target_user_id: string; p_confirm_username: string }
        Returns: undefined
      }
      current_game_campaign: {
        Args: Record<string, never>
        Returns: CurrentGameCampaignRow[]
      }
      admin_list_campaigns: {
        Args: Record<string, never>
        Returns: Database['public']['Tables']['game_campaigns']['Row'][]
      }
      admin_start_campaign: {
        Args: { p_name: string; p_xp_multiplier: number; p_starts_at: string; p_ends_at: string }
        Returns: Database['public']['Tables']['game_campaigns']['Row']
      }
      admin_stop_campaign: {
        Args: { p_campaign_id: string }
        Returns: undefined
      }
      admin_list_user_pillars: {
        Args: { p_target_user_id: string }
        Returns: AdminUserPillarRow[]
      }
      admin_grant_xp: {
        Args: { p_target_user_id: string; p_pillar_id: string; p_amount: number; p_reason: string }
        Returns: Database['public']['Tables']['xp_grants']['Row']
      }
      acknowledge_xp_grant: {
        Args: { p_grant_id: string }
        Returns: undefined
      }
    }
  }
}

export interface AdminLogRow {
  id: string
  admin_id: string | null
  admin_username: string | null
  action: string
  target: string
  created_at: string
}

export interface AdminStatsOverview {
  totalSignups: number
  dau: number
  wau: number
  mau: number
  impactHours: number
  signupsPerDay: { date: string; count: number }[]
  retentionD1: number | null
  retentionD7: number | null
  pillarDistribution: { name: string; count: number }[]
}

export type AdminUserStatus = 'active' | 'suspended' | 'banned'

export interface AdminUserRow {
  id: string
  email: string
  username: string
  display_name: string | null
  created_at: string
  last_active_at: string | null
  role: UserRole
  status: AdminUserStatus
  marketing_consent: boolean
  total_count: number
}

export interface AdminUserExportRow {
  email: string
  username: string
  created_at: string
  last_active_at: string | null
  marketing_consent: boolean
}

export interface AdminUserStats {
  totalFocusSeconds: number
  dailyFocus: { dayStart: number; focusSeconds: number; sessionsCount: number }[]
  pillars: { name: string; level: number; focusSeconds: number }[]
  recentActivity: {
    startedAt: string
    kind: SessionKind
    actualSeconds: number
    pillarName: string | null
  }[]
}

export interface AdminUserPillarRow {
  id: string
  name: string
}

export interface CurrentGameCampaignRow {
  name: string
  xp_multiplier: number
  ends_at: string
}

export interface FriendProfilePreviewRow {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_version: number
}

export interface FriendRow {
  friendship_id: string
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_version: number
  since: string
  live_state: LiveState | null
  live_started_at: string | null
  live_duration_ms: number | null
  live_is_online: boolean
}

export interface UnreadCheerRow {
  id: string
  emoji: CheerEmoji
  created_at: string
  sender_id: string
  sender_username: string
  sender_display_name: string | null
  sender_avatar_url: string | null
  sender_avatar_version: number
}

export interface LeaderboardRow {
  leaderboard_rank: number
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_version: number
  is_self: boolean
  score: number
  focus_seconds: number
  completion_rate: number
  regularity_rate: number
  week_start: string
  week_end: string
}

export interface FriendRequestRow {
  friendship_id: string
  direction: FriendRequestDirection
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_version: number
  created_at: string
}

export interface MyRoomRow {
  room_id: string
  host_id: string
  host_username: string
  host_display_name: string | null
  status: RoomStatus
  focus_minutes: number | null
  my_status: RoomParticipantStatus
  participant_count: number
  created_at: string
  mode: RoomMode
  phase: RoomPhase
  started_at: string | null
  duration_ms: number | null
  elapsed_ms_at_pause: number | null
}

export interface RoomStateRow {
  room_id: string
  host_id: string
  status: RoomStatus
  focus_minutes: number | null
  started_at: string | null
  duration_ms: number | null
  elapsed_ms_at_pause: number | null
  created_at: string
  ended_at: string | null
  participant_user_id: string
  participant_username: string
  participant_display_name: string | null
  participant_avatar_url: string | null
  participant_avatar_version: number
  participant_role: RoomParticipantRole
  participant_status: RoomParticipantStatus
  participant_is_present: boolean
  mode: RoomMode
  phase: RoomPhase
  phase_index: number
  short_break_minutes: number | null
  long_break_minutes: number | null
  sessions_before_long_break: number | null
  /** Heure du serveur au moment de la réponse : sert à corriger l'écart d'horloge. */
  server_now: string
}

export interface DuoStreakRow {
  friend_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  avatar_version: number
  current_streak: number
  longest_streak: number
  last_active_date: string | null
  active_today: boolean
}
