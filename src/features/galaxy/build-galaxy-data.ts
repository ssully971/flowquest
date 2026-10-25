import { startOfDay } from '@/features/timer/pomodoro-cycle'
import type { FocusSessionRecord, PillarRecord } from '@/shared/storage/db'

import { deterministicPosition } from './galaxy-hash'

/** Même teinte neutre que « sans couleur » pour les tâches (task-color.ts) — une session
 * sans pilier n'est jamais invisible, juste discrète. */
export const GALAXY_NEUTRAL_COLOR = '#8A93A6'

/** Au-delà de cette durée réelle, une étoile n'est plus grossie davantage (borne haute —
 * 100 min est la durée de focus maximale proposée par le minuteur, §6.1). */
const REFERENCE_MAX_SECONDS = 100 * 60
const MIN_RADIUS = 2.2
const MAX_RADIUS = 7.5

/** Au-delà de ce nombre d'étoiles individuelles, les sessions les plus anciennes sont
 * regroupées (voir buildGalaxyData) plutôt que toutes rendues une par une. */
export const MAX_INDIVIDUAL_STARS = 1500

export interface GalaxyStar {
  /** Id de la session d'origine, ou `cluster:<mois>:<pilier|none>` pour une étoile
   * agrégée au-delà du plafond. */
  id: string
  x: number
  y: number
  radius: number
  color: string
  isCluster: boolean
  /** Horodatage représentatif (startedAt de la session, ou de la session la plus
   * récente du groupe pour une étoile agrégée). */
  date: number
  durationSeconds: number
  pillarName: string | null
  sessionCount: number
}

export interface GalaxyLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface GalaxyData {
  stars: GalaxyStar[]
  lines: GalaxyLine[]
  /** Nombre de sessions à l'origine des étoiles agrégées (0 si aucun plafond dépassé). */
  clusteredSessionCount: number
}

function clampedRadius(actualSeconds: number): number {
  const clamped = Math.min(Math.max(actualSeconds, 0), REFERENCE_MAX_SECONDS)
  const ratio = Math.sqrt(clamped / REFERENCE_MAX_SECONDS)
  return MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * ratio
}

function monthKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Construit les données de rendu de la Galaxie (LOT G4) à partir des sessions déjà
 * filtrées par période/pilier (voir useGalaxySessions / GalaxyView) — fonction pure,
 * testable sans canvas ni IndexedDB.
 *
 * - Position : hachage déterministe de l'id (galaxy-hash.ts), jamais aléatoire.
 * - Taille : proportionnelle à la durée réelle, bornée (clampedRadius).
 * - Couleur : celle du pilier, gris doux si aucun.
 * - Liaisons : entre sessions individuelles d'un même jour calendaire, dans leur ordre
 *   chronologique (jamais entre étoiles agrégées, qui n'ont pas de jour précis).
 * - Plafond : au-delà de `maxIndividualStars`, les sessions les plus anciennes sont
 *   regroupées une par (mois, pilier) plutôt que rendues individuellement.
 */
export function buildGalaxyData(
  sessions: FocusSessionRecord[],
  pillars: PillarRecord[],
  maxIndividualStars: number = MAX_INDIVIDUAL_STARS,
): GalaxyData {
  const pillarsById = new Map(pillars.map((pillar) => [pillar.id, pillar]))
  const colorFor = (pillarId: string | null) => {
    if (!pillarId) return GALAXY_NEUTRAL_COLOR
    return pillarsById.get(pillarId)?.color ?? GALAXY_NEUTRAL_COLOR
  }
  const nameFor = (pillarId: string | null) =>
    pillarId ? (pillarsById.get(pillarId)?.name ?? null) : null

  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt)
  const individual = sorted.slice(0, maxIndividualStars)
  const overflow = sorted.slice(maxIndividualStars)

  const stars: GalaxyStar[] = individual.map((session) => {
    const { x, y } = deterministicPosition(session.id)
    return {
      id: session.id,
      x,
      y,
      radius: clampedRadius(session.actualSeconds),
      color: colorFor(session.pillarId),
      isCluster: false,
      date: session.startedAt,
      durationSeconds: session.actualSeconds,
      pillarName: nameFor(session.pillarId),
      sessionCount: 1,
    }
  })

  if (overflow.length > 0) {
    const clusters = new Map<
      string,
      { pillarId: string | null; totalSeconds: number; count: number; latest: number }
    >()
    for (const session of overflow) {
      const key = `${monthKey(session.startedAt)}:${session.pillarId ?? 'none'}`
      const existing = clusters.get(key)
      if (existing) {
        existing.totalSeconds += session.actualSeconds
        existing.count += 1
        existing.latest = Math.max(existing.latest, session.startedAt)
      } else {
        clusters.set(key, {
          pillarId: session.pillarId,
          totalSeconds: session.actualSeconds,
          count: 1,
          latest: session.startedAt,
        })
      }
    }
    for (const [key, cluster] of clusters) {
      const { x, y } = deterministicPosition(`cluster:${key}`)
      stars.push({
        id: `cluster:${key}`,
        x,
        y,
        radius: clampedRadius(cluster.totalSeconds),
        color: colorFor(cluster.pillarId),
        isCluster: true,
        date: cluster.latest,
        durationSeconds: cluster.totalSeconds,
        pillarName: nameFor(cluster.pillarId),
        sessionCount: cluster.count,
      })
    }
  }

  // Liaisons entre étoiles individuelles d'un même jour, dans leur ordre chronologique.
  const byDay = new Map<number, GalaxyStar[]>()
  for (const star of stars) {
    if (star.isCluster) continue
    const day = startOfDay(star.date)
    const group = byDay.get(day)
    if (group) group.push(star)
    else byDay.set(day, [star])
  }

  const lines: GalaxyLine[] = []
  for (const group of byDay.values()) {
    if (group.length < 2) continue
    group.sort((a, b) => a.date - b.date)
    for (let i = 1; i < group.length; i++) {
      const previous = group[i - 1]
      const current = group[i]
      lines.push({ x1: previous.x, y1: previous.y, x2: current.x, y2: current.y })
    }
  }

  return {
    stars,
    lines,
    clusteredSessionCount: overflow.length,
  }
}
