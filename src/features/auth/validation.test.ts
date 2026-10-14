import { describe, expect, it } from 'vitest'

import { isValidEmail, isValidPassword, isValidUsername } from './validation'

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

describe('isValidEmail', () => {
  it('refuse une adresse sans @', () => {
    expect(isValidEmail('pas-un-email')).toBe(false)
  })
  it('accepte une adresse valide', () => {
    expect(isValidEmail('sullivan@exemple.com')).toBe(true)
  })
})
