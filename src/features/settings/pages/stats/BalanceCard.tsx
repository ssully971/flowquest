import { levelProgressForXp } from '@/features/pillars/pillar-xp'
import type { PillarRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

interface BalanceCardProps {
  activePillars: PillarRecord[]
}

const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 72
const RING_FRACTIONS = [0.25, 0.5, 0.75, 1]
const MIN_FRACTION = 0.04

function axisPoint(index: number, count: number, fraction: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / count
  return {
    x: CENTER + RADIUS * fraction * Math.cos(angle),
    y: CENTER + RADIUS * fraction * Math.sin(angle),
  }
}

function polygonPoints(count: number, fraction: number): string {
  return Array.from({ length: count }, (_, index) => {
    const { x, y } = axisPoint(index, count, fraction)
    return `${x},${y}`
  }).join(' ')
}

/**
 * Carte « Équilibre » (LOT G3) : un graphique radar, un axe par pilier actif, qui
 * montre l'équilibre relatif entre eux (XP totale normalisée au plus investi) plutôt
 * qu'une échelle absolue — avec moins de 3 piliers actifs, un radar n'a pas de sens
 * géométrique, on affiche un message clair à la place.
 */
export function BalanceCard({ activePillars }: BalanceCardProps) {
  const s = strings.settings.pillars.balance

  if (activePillars.length < 3) {
    return (
      <div className="max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <p className="mb-1 text-sm font-medium text-[var(--panel-text)]">{s.title}</p>
        <p className="text-xs text-[var(--panel-muted)]">{s.needMorePillars}</p>
      </div>
    )
  }

  const maxXp = Math.max(1, ...activePillars.map((pillar) => pillar.currentXp))
  const count = activePillars.length
  const dataFractions = activePillars.map((pillar) =>
    Math.max(MIN_FRACTION, pillar.currentXp / maxXp),
  )
  const dataPoints = activePillars
    .map((_, index) => {
      const { x, y } = axisPoint(index, count, dataFractions[index])
      return `${x},${y}`
    })
    .join(' ')

  const altText = activePillars
    .map((pillar) => `${pillar.name} : ${s.level} ${pillar.level}`)
    .join(', ')

  return (
    <div className="max-w-md rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <p className="mb-3 text-sm font-medium text-[var(--panel-text)]">{s.title}</p>

      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`${s.chartLabel} : ${altText}`}
        className="mx-auto w-full max-w-[240px]"
      >
        {RING_FRACTIONS.map((fraction) => (
          <polygon
            key={fraction}
            points={polygonPoints(count, fraction)}
            fill="none"
            stroke="var(--panel-line)"
            strokeWidth={1}
          />
        ))}

        {activePillars.map((_, index) => {
          const { x, y } = axisPoint(index, count, 1)
          return (
            <line
              key={index}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              stroke="var(--panel-line)"
              strokeWidth={1}
            />
          )
        })}

        <polygon
          points={dataPoints}
          fill="var(--accent)"
          fillOpacity={0.25}
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {activePillars.map((pillar, index) => {
          const { x, y } = axisPoint(index, count, dataFractions[index])
          return (
            <circle key={pillar.id} cx={x} cy={y} r={3.5} fill={pillar.color} aria-hidden="true" />
          )
        })}
      </svg>

      <ul className="mt-3 flex flex-col gap-2">
        {activePillars.map((pillar) => {
          const { xpInLevel, xpForNextLevel } = levelProgressForXp(pillar.currentXp)
          const progressPct = Math.min(100, Math.round((xpInLevel / xpForNextLevel) * 100))
          return (
            <li key={pillar.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: pillar.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate text-[var(--panel-text)]">{pillar.name}</span>
              <span className="shrink-0 text-[var(--panel-muted)]">
                {s.level} {pillar.level}
              </span>
              <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-[var(--panel-line)]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${progressPct}%`, backgroundColor: pillar.color }}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
