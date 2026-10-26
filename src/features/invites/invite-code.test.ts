import { describe, expect, it } from 'vitest'

import { isInviteCodeWellFormed, normalizeInviteCode } from './invite-code'

describe('invite-code', () => {
  it('normalise : trim, majuscules, retrait des espaces et tirets', () => {
    expect(normalizeInviteCode('  abcd-efgh ')).toBe('ABCDEFGH')
    expect(normalizeInviteCode('ab cd 23')).toBe('ABCD23')
  })

  it('accepte 6 à 8 caractères sans 0/O/1/I/L', () => {
    expect(isInviteCodeWellFormed('ABCD23')).toBe(true)
    expect(isInviteCodeWellFormed('ABCD2345')).toBe(true)
    expect(isInviteCodeWellFormed('ABCD2')).toBe(false)
    expect(isInviteCodeWellFormed('ABCD23456')).toBe(false)
    for (const bad of ['ABCD0234', 'ABCDO234', 'ABCD1234', 'ABCDI234', 'ABCDL234']) {
      expect(isInviteCodeWellFormed(bad)).toBe(false)
    }
  })
})
