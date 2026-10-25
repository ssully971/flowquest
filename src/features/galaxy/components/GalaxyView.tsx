import { useMemo, useState } from 'react'

import { usePillars } from '@/features/pillars/usePillars'
import { strings } from '@/shared/i18n'

import { buildGalaxyData } from '../build-galaxy-data'
import { useGalaxySessions } from '../useGalaxySessions'
import { GalaxyCanvas } from './GalaxyCanvas'

type PeriodFilter = '30d' | '90d' | 'all'

const DAY_MS = 24 * 60 * 60 * 1000

function periodStartFor(period: PeriodFilter): number | null {
  if (period === 'all') return null
  const days = period === '30d' ? 30 : 90
  return Date.now() - days * DAY_MS
}

/**
 * Vue Galaxie (LOT G4) : montée seulement quand l'onglet « Galaxie » de Stats est actif
 * (voir StatsPage.tsx) — c'est ce montage/démontage React qui garantit qu'aucune session
 * n'est chargée au démarrage de l'app, pas un indicateur `enabled` séparé.
 */
export function GalaxyView() {
  const s = strings.settings.galaxy
  const [period, setPeriod] = useState<PeriodFilter>('90d')
  const [pillarFilter, setPillarFilter] = useState<string>('all')
  const { pillars, activePillars } = usePillars()

  const periodStartMs = useMemo(() => periodStartFor(period), [period])
  const { sessions, isLoading } = useGalaxySessions({ enabled: true, periodStartMs })

  const filteredSessions = useMemo(() => {
    if (pillarFilter === 'all') return sessions
    if (pillarFilter === 'none') return sessions.filter((session) => session.pillarId === null)
    return sessions.filter((session) => session.pillarId === pillarFilter)
  }, [sessions, pillarFilter])

  const data = useMemo(
    () => buildGalaxyData(filteredSessions, pillars),
    [filteredSessions, pillars],
  )

  const isEmpty = !isLoading && data.stars.length === 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
          {s.period}
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
            className="h-8 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-xs text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="30d">{s.periods['30d']}</option>
            <option value="90d">{s.periods['90d']}</option>
            <option value="all">{s.periods.all}</option>
          </select>
        </label>

        <label className="flex items-center gap-1.5 text-xs text-[var(--panel-muted)]">
          {s.pillarFilter}
          <select
            value={pillarFilter}
            onChange={(event) => setPillarFilter(event.target.value)}
            className="h-8 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-xs text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">{s.allPillars}</option>
            {activePillars.map((pillar) => (
              <option key={pillar.id} value={pillar.id}>
                {pillar.name}
              </option>
            ))}
            <option value="none">{s.noPillar}</option>
          </select>
        </label>
      </div>

      <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-[var(--panel-line)] bg-[radial-gradient(ellipse_at_center,_rgba(124,58,237,0.08),_transparent_70%)]">
        {isLoading ? (
          <p className="flex h-full items-center justify-center text-sm text-[var(--panel-muted)]">
            {s.loading}
          </p>
        ) : isEmpty ? (
          <p className="flex h-full items-center justify-center px-8 text-center text-sm text-[var(--panel-muted)]">
            {s.empty}
          </p>
        ) : (
          <GalaxyCanvas data={data} />
        )}
      </div>

      {data.clusteredSessionCount > 0 ? (
        <p className="text-xs text-[var(--panel-muted)]">
          + {data.clusteredSessionCount} {s.overflowNoteSuffix}
        </p>
      ) : null}
    </div>
  )
}
