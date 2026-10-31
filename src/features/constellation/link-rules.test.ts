import { describe, expect, it } from 'vitest'

import type { TaskLinkRecord } from '@/shared/storage/db'

import { canonicalLink, validateNewLink } from './link-rules'

const link = (overrides: Partial<TaskLinkRecord>): TaskLinkRecord => ({
  id: 'l',
  fromTaskId: 'a',
  toTaskId: 'b',
  kind: 'related',
  createdAt: 0,
  ...overrides,
})

describe('link-rules', () => {
  it('« lié à » est canonique (plus petit id d’abord), « dépend de » garde son sens', () => {
    expect(canonicalLink('b', 'a', 'related')).toEqual({
      fromTaskId: 'a',
      toTaskId: 'b',
      kind: 'related',
    })
    expect(canonicalLink('b', 'a', 'depends_on')).toEqual({
      fromTaskId: 'b',
      toTaskId: 'a',
      kind: 'depends_on',
    })
  })

  it('refuse un lien d’une tâche sur elle-même', () => {
    expect(validateNewLink([], 'a', 'a', 'related')).toBe('self')
  })

  it('refuse un doublon, y compris « lié à » dans l’autre sens', () => {
    const existing = [link({})]
    expect(validateNewLink(existing, 'a', 'b', 'related')).toBe('duplicate')
    expect(validateNewLink(existing, 'b', 'a', 'related')).toBe('duplicate')
    expect(validateNewLink(existing, 'a', 'b', 'depends_on')).toBeNull()
  })

  it('refuse une dépendance circulaire immédiate', () => {
    const existing = [link({ kind: 'depends_on', fromTaskId: 'a', toTaskId: 'b' })]
    expect(validateNewLink(existing, 'b', 'a', 'depends_on')).toBe('reverse-dependency')
    expect(validateNewLink(existing, 'a', 'b', 'depends_on')).toBe('duplicate')
    expect(validateNewLink(existing, 'a', 'c', 'depends_on')).toBeNull()
  })
})
