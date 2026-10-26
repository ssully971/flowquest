import { useEffect, useState } from 'react'

import { isSupabaseConfigured } from '@/shared/supabase/client'
import type { AdminStatsOverview } from '@/shared/supabase/database.types'
import { strings } from '@/shared/i18n'

import { fetchAdminStatsOverview } from '../stats-admin'

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })

function StatCard({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] px-4 py-3">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <span
        className="text-2xl font-bold text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {value.toLocaleString('fr-FR')}
        {suffix ?? ''}
      </span>
    </div>
  )
}

/**
 * Vue d'ensemble (lot I2, §2) : sobre, graphite — jamais la couleur de marque en masse
 * (seule la barre « aujourd'hui » du graphique d'inscriptions et le grand nombre du
 * compteur d'impact portent --accent, le reste reste neutre). Alternative texte sur
 * chaque visualisation (role="img" + aria-label), même convention que FocusTrend.tsx.
 */
export function AdminOverviewPanel() {
  const s = strings.admin.overview
  const [stats, setStats] = useState<AdminStatsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Ne touche jamais `loading`/`loadError` en entrée (seulement dans le .then()) : appelée
  // directement depuis l'effet de montage ci-dessous, où un appel synchrone à setState
  // est interdit (voir react-hooks/set-state-in-effect). Le bouton Réessayer remet ces
  // deux états à leur valeur de départ lui-même, avant d'appeler cette fonction.
  const load = () => {
    void fetchAdminStatsOverview().then((result) => {
      setLoading(false)
      if (!result) {
        setLoadError(true)
        return
      }
      setStats(result)
    })
  }

  useEffect(() => {
    load()
  }, [])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }
  if (loading) return <p className="text-sm text-[var(--muted)]">{s.loading}</p>
  if (loadError || !stats) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-[var(--muted)]">{s.loadError}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setLoadError(false)
            load()
          }}
          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
        >
          {s.retry}
        </button>
      </div>
    )
  }

  const maxSignups = Math.max(1, ...stats.signupsPerDay.map((point) => point.count))
  const todayIso = new Date().toISOString().slice(0, 10)
  const maxPillarCount = Math.max(1, ...stats.pillarDistribution.map((item) => item.count))

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={s.totalSignups} value={stats.totalSignups} />
        <StatCard label={s.dau} value={stats.dau} />
        <StatCard label={s.wau} value={stats.wau} />
        <StatCard label={s.mau} value={stats.mau} />
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border border-[var(--line)] px-5 py-4">
        <span className="text-xs text-[var(--muted)]">{s.impactTitle}</span>
        <span
          className="text-4xl font-extrabold text-[var(--accent)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {stats.impactHours.toLocaleString('fr-FR')}
        </span>
        <span className="text-xs text-[var(--muted)]">{s.impactSuffix}</span>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">{s.signupsChartTitle}</p>
        <div className="flex max-w-xl items-end gap-[2px]">
          {stats.signupsPerDay.map((point) => {
            const heightPct = Math.max(4, (point.count / maxSignups) * 100)
            const label = `${SHORT_DATE_FORMATTER.format(new Date(point.date))} : ${point.count}`
            return (
              <div key={point.date} className="flex h-20 flex-1 items-end">
                <div
                  role="img"
                  aria-label={label}
                  title={label}
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${heightPct}%`,
                    background: point.date === todayIso ? 'var(--accent)' : 'var(--muted)',
                    opacity: point.date === todayIso ? 1 : 0.45,
                  }}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">{s.retentionTitle}</p>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <StatCard label={s.retentionD1} value={stats.retentionD1 ?? 0} suffix=" %" />
          <StatCard label={s.retentionD7} value={stats.retentionD7 ?? 0} suffix=" %" />
        </div>
        {stats.retentionD1 === null && stats.retentionD7 === null ? (
          <p className="text-xs text-[var(--muted)]">{s.noRetention}</p>
        ) : (
          <p className="text-xs text-[var(--muted)]">{s.retentionHint}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-[var(--muted)]">{s.pillarsTitle}</p>
        {stats.pillarDistribution.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty}</p>
        ) : (
          <div className="flex max-w-md flex-col gap-1.5">
            {stats.pillarDistribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span
                  className="w-28 shrink-0 truncate text-xs text-[var(--text)]"
                  title={item.name}
                >
                  {item.name}
                </span>
                <div
                  role="img"
                  aria-label={`${item.name} : ${item.count}`}
                  className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--line)]"
                >
                  <div
                    className="h-full rounded-full bg-[var(--muted)]"
                    style={{ width: `${Math.max(4, (item.count / maxPillarCount) * 100)}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right text-xs text-[var(--muted)]">
                  {item.count}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--muted)]">{s.pillarsHint}</p>
      </div>
    </div>
  )
}
