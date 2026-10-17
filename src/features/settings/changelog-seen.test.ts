import { beforeEach, describe, expect, it } from 'vitest'

import { getLastSeenChangelogVersion, markChangelogSeen } from './changelog-seen'

describe('changelog-seen — badge « nouveau » (§7.9 du cahier des charges)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('retourne null quand rien n’a encore été vu', () => {
    expect(getLastSeenChangelogVersion()).toBeNull()
  })

  it('persiste la version marquée comme vue', () => {
    markChangelogSeen('0.3.0')
    expect(getLastSeenChangelogVersion()).toBe('0.3.0')
  })
})
