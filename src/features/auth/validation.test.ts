import { describe, expect, it } from 'vitest'

import { getUsernameFormatIssue, isValidEmail, isValidPassword, isValidUsername } from './validation'

describe('isValidPassword — 8 caractères min., 1 majuscule, 1 chiffre (cahier des charges §4)', () => {
  it('refuse un mot de passe trop court', () => {
    expect(isValidPassword('Abc123')).toBe(false)
  })
  it('refuse un mot de passe sans majuscule', () => {
    expect(isValidPassword('abcdefg1')).toBe(false)
  })
  it('refuse un mot de passe sans chiffre', () => {
    expect(isValidPassword('Abcdefgh')).toBe(false)
  })
  it('accepte un mot de passe valide', () => {
    expect(isValidPassword('Abcdefg1')).toBe(true)
  })
})

describe('isValidUsername — pseudo unique, 3 à 20 caractères, minuscules/chiffres/underscore', () => {
  it('refuse un pseudo trop court', () => {
    expect(isValidUsername('ab')).toBe(false)
  })
  it('refuse les majuscules et espaces', () => {
    expect(isValidUsername('Sullivan H')).toBe(false)
  })
  it('accepte un pseudo valide', () => {
    expect(isValidUsername('sullivan_97')).toBe(true)
  })
})

describe('getUsernameFormatIssue — raison précise, en direct (LOT 1)', () => {
  it('signale un pseudo trop court', () => {
    expect(getUsernameFormatIssue('ab')).toBe('tooShort')
  })
  it('signale un pseudo trop long', () => {
    expect(getUsernameFormatIssue('a'.repeat(21))).toBe('tooLong')
  })
  it('signale des caractères interdits (majuscule, espace, accent)', () => {
    expect(getUsernameFormatIssue('Sullivan H')).toBe('invalidChars')
  })
  it('signale un mot réservé même si le format est valide', () => {
    expect(getUsernameFormatIssue('admin')).toBe('reserved')
    expect(getUsernameFormatIssue('administrateur')).toBe('reserved')
    expect(getUsernameFormatIssue('modo')).toBe('reserved')
    expect(getUsernameFormatIssue('moderateur')).toBe('reserved')
    expect(getUsernameFormatIssue('staff')).toBe('reserved')
    expect(getUsernameFormatIssue('root')).toBe('reserved')
    expect(getUsernameFormatIssue('system')).toBe('reserved')
    expect(getUsernameFormatIssue('null')).toBe('reserved')
    expect(getUsernameFormatIssue('undefined')).toBe('reserved')
  })
  it('ne signale rien pour un pseudo valide', () => {
    expect(getUsernameFormatIssue('sullivan_97')).toBeNull()
  })
})

describe('isValidEmail', () => {
  it('refuse une adresse sans @', () => {
    expect(isValidEmail('pas-un-email')).toBe(false)
  })
  it('accepte une adresse valide', () => {
    expect(isValidEmail('sullivan@exemple.com')).toBe(true)
  })
})
