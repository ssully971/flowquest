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
          friend_code: string
          avatar_version: number
          invisible_mode: boolean
          show_live_status: boolean
          show_total_time_score: boolean
          participate_leaderboard: boolean
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
        }
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
          group_session_id: string | null
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
          group_session_id?: string | null
        }
        Update: {
          actual_seconds?: number
          ended_at?: string | null
          completed?: boolean
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
    }
  }
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
