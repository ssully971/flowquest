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
        }
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
        }
        Update: {
          schema_version?: number
          settings?: Record<string, unknown>
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
    }
  }
}
