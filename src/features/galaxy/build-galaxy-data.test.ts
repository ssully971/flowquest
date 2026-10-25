import { describe, expect, it } from 'vitest'

import type { FocusSessionRecord, PillarRecord } from '@/shared/storage/db'

import { GALAXY_NEUTRAL_COLOR, buildGalaxyData } from './build-galaxy-data'

function session(
  overrides: Partial<FocusSessionRecord> & { id: string; startedAt: number },
): FocusSessionRecord {
  return {
    kind: 'focus',
    plannedSeconds: 1500,
    actualSeconds: 1500,
    endedAt: overrides.startedAt + 1500_000,
    completed: true,
    taskId: null,
    pillarId: null,
    syncedAt: null,
    ...overrides,
  }
}

function pillar(overrides: Partial<PillarRecord> & { id: string }): PillarRecord {
  return {
    name: 'Pilier',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: 0,
    archivedAt: null,
    ...overrides,
  }
}

const DAY = 24 * 60 * 60 * 1000
const BASE = new Date('2026-01-15T10:00:00').getTime()

describe('buildGalaxyData — étoiles (LOT G4)', () => {
  it('une étoile par session, positions déterministes et stables', () => {
    const sessions = [session({ id: 's1', startedAt: BASE })]
    const first = buildGalaxyData(sessions, [])
    const second = buildGalaxyData(sessions, [])
    expect(first.stars).toHaveLength(1)
    expect(first.stars[0]).toEqual(second.stars[0])
  })

  it('couleur du pilier si rattachée, gris doux sinon', () => {
    const pillars = [pillar({ id: 'p1', color: '#5FB86B' })]
    const sessions = [
      session({ id: 's1', startedAt: BASE, pillarId: 'p1' }),
      session({ id: 's2', startedAt: BASE - DAY, pillarId: null }),
    ]
    const { stars } = buildGalaxyData(sessions, pillars)
    expect(stars.find((s) => s.id === 's1')?.color).toBe('#5FB86B')
    expect(stars.find((s) => s.id === 's2')?.color).toBe(GALAXY_NEUTRAL_COLOR)
  })

  it('couleur neutre si le pilier référencé n’existe plus (supprimé)', () => {
    const sessions = [session({ id: 's1', startedAt: BASE, pillarId: 'gone' })]
    const { stars } = buildGalaxyData(sessions, [])
    expect(stars[0].color).toBe(GALAXY_NEUTRAL_COLOR)
  })

  it('taille bornée : une session très courte et une très longue restent dans les bornes', () => {
    const sessions = [
      session({ id: 'short', startedAt: BASE, actualSeconds: 1 }),
      session({ id: 'long', startedAt: BASE - DAY, actualSeconds: 100 * 60 * 10 }), // 10x le plafond
    ]
    const { stars } = buildGalaxyData(sessions, [])
    const short = stars.find((s) => s.id === 'short')!
    const long = stars.find((s) => s.id === 'long')!
    expect(short.radius).toBeGreaterThan(0)
    expect(long.radius).toBeGreaterThan(short.radius)
    expect(long.radius).toBeLessThanOrEqual(7.5)
  })

  it('x/y toujours dans [0, 1)', () => {
    const sessions = [session({ id: 's1', startedAt: BASE })]
    const { stars } = buildGalaxyData(sessions, [])
    expect(stars[0].x).toBeGreaterThanOrEqual(0)
    expect(stars[0].x).toBeLessThan(1)
    expect(stars[0].y).toBeGreaterThanOrEqual(0)
    expect(stars[0].y).toBeLessThan(1)
  })
})

describe('buildGalaxyData — liaisons du même jour (LOT G4)', () => {
  it('relie deux sessions du même jour, dans l’ordre chronologique', () => {
    const sessions = [
      session({ id: 'morning', startedAt: BASE }),
      session({ id: 'evening', startedAt: BASE + 5 * 60 * 60 * 1000 }),
    ]
    const { lines, stars } = buildGalaxyData(sessions, [])
    expect(lines).toHaveLength(1)
    const morning = stars.find((s) => s.id === 'morning')!
    const evening = stars.find((s) => s.id === 'evening')!
    expect(lines[0]).toEqual({ x1: morning.x, y1: morning.y, x2: evening.x, y2: evening.y })
  })

  it('ne relie jamais deux sessions de jours différents', () => {
    const sessions = [
      session({ id: 's1', startedAt: BASE }),
      session({ id: 's2', startedAt: BASE + DAY }),
    ]
    const { lines } = buildGalaxyData(sessions, [])
    expect(lines).toHaveLength(0)
  })

  it('trois sessions le même jour → deux segments consécutifs', () => {
    const sessions = [
      session({ id: 'a', startedAt: BASE }),
      session({ id: 'b', startedAt: BASE + 2 * 60 * 60 * 1000 }),
      session({ id: 'c', startedAt: BASE + 4 * 60 * 60 * 1000 }),
    ]
    const { lines } = buildGalaxyData(sessions, [])
    expect(lines).toHaveLength(2)
  })
})

describe('buildGalaxyData — plafond et regroupement (LOT G4)', () => {
  it('sous le plafond, aucune étoile agrégée', () => {
    const sessions = [session({ id: 's1', startedAt: BASE })]
    const { stars, clusteredSessionCount } = buildGalaxyData(sessions, [], 10)
    expect(stars).toHaveLength(1)
    expect(stars[0].isCluster).toBe(false)
    expect(clusteredSessionCount).toBe(0)
  })

  it('garde les N sessions les plus récentes individuelles, regroupe le reste', () => {
    const sessions = [
      session({ id: 'recent-1', startedAt: BASE }),
      session({ id: 'recent-2', startedAt: BASE - DAY }),
      session({ id: 'old-1', startedAt: BASE - 40 * DAY }),
      session({ id: 'old-2', startedAt: BASE - 41 * DAY }),
    ]
    const { stars, clusteredSessionCount } = buildGalaxyData(sessions, [], 2)
    const individualStars = stars.filter((s) => !s.isCluster)
    const clusterStars = stars.filter((s) => s.isCluster)
    expect(individualStars.map((s) => s.id).sort()).toEqual(['recent-1', 'recent-2'])
    expect(clusterStars.length).toBeGreaterThan(0)
    expect(clusteredSessionCount).toBe(2)
  })

  it('une étoile agrégée cumule la durée et le nombre de sessions du groupe', () => {
    const sameMonth = new Date('2025-12-05T08:00:00').getTime()
    const sameMonth2 = new Date('2025-12-20T08:00:00').getTime()
    const sessions = [
      session({ id: 'recent', startedAt: BASE }),
      session({ id: 'old-1', startedAt: sameMonth, actualSeconds: 600, pillarId: 'p1' }),
      session({ id: 'old-2', startedAt: sameMonth2, actualSeconds: 900, pillarId: 'p1' }),
    ]
    const { stars } = buildGalaxyData(sessions, [pillar({ id: 'p1' })], 1)
    const cluster = stars.find((s) => s.isCluster)!
    expect(cluster.sessionCount).toBe(2)
    expect(cluster.durationSeconds).toBe(1500)
  })

  it('les étoiles agrégées ne participent jamais aux liaisons du jour', () => {
    const sameMonth = new Date('2026-02-05T08:00:00').getTime()
    const sameMonthLater = new Date('2026-02-05T12:00:00').getTime()
    const sessions = [
      session({ id: 'recent', startedAt: BASE }),
      session({ id: 'old-1', startedAt: sameMonth }),
      session({ id: 'old-2', startedAt: sameMonthLater }),
    ]
    const { lines } = buildGalaxyData(sessions, [], 1)
    expect(lines).toHaveLength(0)
  })
})
