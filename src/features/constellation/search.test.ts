import { describe, expect, it } from 'vitest'

import type { GraphNode } from './build-graph'
import { MAX_SEARCH_RESULTS, normalizeForSearch, searchTasks } from './search'

const node = (id: string, label: string, overrides: Partial<GraphNode> = {}): GraphNode => ({
  id,
  kind: 'task',
  label,
  pillarId: 'p1',
  color: '#4A9FE8',
  radius: 8,
  brightness: 1,
  done: false,
  archived: false,
  seconds: 0,
  ...overrides,
})

describe('searchTasks', () => {
  const nodes = [
    node('1', 'Anatomie'),
    node('2', 'Cours d’anatomie du pied'),
    node('3', 'Biomol · cours 3'),
    node('4', 'Étudier la pharmaco', { done: true }),
    node('5', 'Mémoire d’étude'),
    node('p', 'Études', { kind: 'pillar' }),
    node('g', 'Anatomie ancienne', { kind: 'group' }),
  ]

  it('normalise : minuscules, sans accents', () => {
    expect(normalizeForSearch('  ÉTUDIER à l’Été ')).toBe('etudier a l’ete')
  })

  it('requête vide : aucun résultat, rien à estomper', () => {
    expect(searchTasks(nodes, '   ')).toEqual({ results: [], matchIds: new Set() })
  })

  it('trouve sans tenir compte de la casse ni des accents', () => {
    const { results } = searchTasks(nodes, 'ETUD')
    expect(results.map((r) => r.id)).toEqual(['4', '5'])
  })

  it('classe : début du nom, puis début d’un mot, puis contient', () => {
    const { results } = searchTasks(nodes, 'anat')
    expect(results.map((r) => r.id)).toEqual(['1', '2']) // « Anatomie » avant « Cours d'anatomie… »
    const contains = searchTasks([node('a', 'Sous-anatomie'), node('b', 'Zanatomie')], 'anat')
    expect(contains.results.map((r) => r.id)).toEqual(['a', 'b']) // mot (après un tiret) avant « contient »
  })

  it('ne cherche que les tâches : ni piliers ni groupes', () => {
    expect(searchTasks(nodes, 'etudes').results.map((r) => r.id)).toEqual([])
    expect(searchTasks(nodes, 'ancienne').results).toEqual([])
  })

  it('renvoie nom, pilier, couleur et statut de chaque résultat', () => {
    const [result] = searchTasks(nodes, 'pharmaco').results
    expect(result).toEqual({
      id: '4',
      label: 'Étudier la pharmaco',
      pillarId: 'p1',
      color: '#4A9FE8',
      done: true,
    })
  })

  it('limite la liste à 8 mais garde toutes les correspondances pour le surlignage', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      node(`t${String(i).padStart(2, '0')}`, `Lecture ${i}`),
    )
    const outcome = searchTasks(many, 'lecture')
    expect(outcome.results).toHaveLength(MAX_SEARCH_RESULTS)
    expect(outcome.matchIds.size).toBe(20)
  })

  it('aucune correspondance : liste vide', () => {
    expect(searchTasks(nodes, 'zzz')).toEqual({ results: [], matchIds: new Set() })
  })
})
