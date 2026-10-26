import { X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { DEFAULT_DAILY_GOAL_MINUTES } from '@/features/stats/compute-stats'
import type { DayFocus } from '@/features/stats/compute-stats'
import { formatFocusDuration } from '@/features/stats/format'
import { FocusCalendar } from '@/features/settings/pages/stats/FocusCalendar'
import { strings } from '@/shared/i18n'
import type { AdminUserStats, SessionKind } from '@/shared/supabase/database.types'

import { fetchAdminUserStats } from '../admin-user-stats'
import { AdminDeleteUserDialog } from './AdminDeleteUserDialog'

interface AdminUserDetailProps {
  userId: string
  username: string
  canDelete: boolean
  onClose: () => void
  onDeleted: () => void
}

function kindLabel(kind: SessionKind, s: typeof strings.admin.godMode): string {
  if (kind === 'short_break') return s.kindShortBreak
  if (kind === 'long_break') return s.kindLongBreak
  return s.kindFocus
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Profil détaillé « god mode » (LOT I3, §3) : lecture seule des STATISTIQUES uniquement
 * (admin_user_stats() ne lit jamais le contenu des tâches/notes/messages). Chaque
 * ouverture journalise déjà côté serveur — le bandeau ici n'est qu'un rappel visuel, pas
 * la protection elle-même.
 */
export function AdminUserDetail({
  userId,
  username,
  canDelete,
  onClose,
  onDeleted,
}: AdminUserDetailProps) {
  const s = strings.admin.godMode
  const [stats, setStats] = useState<AdminUserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    // Pas de reset synchrone ici : le composant parent remonte AdminUserDetail avec
    // key={userId} (voir AdminUsersPanel), donc loading/loadError repartent déjà de leur
    // valeur initiale (true/false) à chaque changement d'utilisateur.
    void fetchAdminUserStats(userId).then((result) => {
      setLoading(false)
      if (!result) {
        setLoadError(true)
        return
      }
      setStats(result)
    })
  }, [userId])

  const days: DayFocus[] =
    stats?.dailyFocus.map((day) => ({
      dayStart: day.dayStart,
      focusSeconds: day.focusSeconds,
      sessionsCount: day.sessionsCount,
      goalMet: false,
    })) ?? []

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[var(--text)]">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <p className="rounded-xl border border-[var(--line)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
          {s.banner}
        </p>

        {loading ? (
          <p className="text-sm text-[var(--muted)]">{s.loading}</p>
        ) : loadError || !stats ? (
          <p className="text-sm text-[var(--muted)]">{s.loadError}</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs text-[var(--muted)]">{s.totalFocusTitle}</p>
              <p className="text-2xl font-semibold text-[var(--text)]">
                {formatFocusDuration(stats.totalFocusSeconds)}
              </p>
            </div>

            <FocusCalendar days={days} dailyGoalMinutes={DEFAULT_DAILY_GOAL_MINUTES} />

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">{s.pillarsTitle}</p>
              {stats.pillars.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{s.noPillars}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {stats.pillars.map((pillar) => (
                    <div
                      key={pillar.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-[var(--text)]">
                        {pillar.name} · {strings.pillars.level} {pillar.level}
                      </span>
                      <span className="text-[var(--muted)]">
                        {formatFocusDuration(pillar.focusSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">
                {s.recentActivityTitle}
              </p>
              {stats.recentActivity.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">{s.noRecentActivity}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {stats.recentActivity.map((activity, index) => (
                    <div
                      key={`${activity.startedAt}-${index}`}
                      className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]"
                    >
                      <span>{formatWhen(activity.startedAt)}</span>
                      <span>{kindLabel(activity.kind, s)}</span>
                      {activity.pillarName ? <span>{activity.pillarName}</span> : null}
                      <span className="text-[var(--text)]">
                        {formatFocusDuration(activity.actualSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {canDelete ? (
              deleting ? (
                <AdminDeleteUserDialog
                  userId={userId}
                  username={username}
                  onDeleted={onDeleted}
                  onCancel={() => setDeleting(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDeleting(true)}
                  className="h-9 w-fit rounded-lg border px-3 text-xs font-medium"
                  style={{ borderColor: '#E5484D', color: '#E5484D' }}
                >
                  {strings.admin.deleteUser.title}
                </button>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
