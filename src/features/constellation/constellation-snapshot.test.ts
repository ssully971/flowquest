import { beforeEach, describe, expect, it } from 'vitest'

import { getDb } from '@/shared/storage/db'

import { decorativeSnapshot, loadConstellationSnapshot } from './constellation-snapshot'

async function clear() {
  const db = await getDb()
  for (const store of [
    'tasks',
    'pillars',
    'focusSessions',
    'taskLinks',
    'constellationLayout',
  ] as const) {
    const keys = await db.getAllKeys(store)
    await Promise.all(keys.map((key) => db.delete(store, key)))
  }
}

describe('loadConstellationSnapshot', () => {
  beforeEach(clear)

  it('sans tâche : constellation décorative douce, identique à chaque appel', async () => {
    const first = await loadConstellationSnapshot()
    const second = await loadConstellationSnapshot()
    expect(first.decorative).toBe(true)
    expect(first.graph.nodes.filter((n) => n.kind === 'task').length).toBeGreaterThan(20)
    expect(first.positions).toEqual(second.positions)
    expect(decorativeSnapshot()).toBe(decorativeSnapshot())
  })

  it('avec des tâches : leur constellation, positions enregistrées respectées', async () => {
    const db = await getDb()
    await db.put('tasks', {
      id: 'a',
      title: 'Lire',
      emoji: null,
      color: null,
      etaMinutes: null,
      parentId: null,
      position: 0,
      done: true,
      doneAt: 5,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.put(
      'constellationLayout',
      { positions: { a: { x: 123, y: -45 }, __none__: { x: 0, y: 0 } }, updatedAt: 1 },
      'current',
    )

    const snapshot = await loadConstellationSnapshot()
    expect(snapshot.decorative).toBe(false)
    expect(snapshot.graph.nodes.some((n) => n.id === 'a')).toBe(true)
    expect(snapshot.positions.a).toEqual({ x: 123, y: -45 })
  })
})
