import { beforeEach, describe, expect, it } from 'vitest'

import { getLastSettingsPage, setLastSettingsPage } from './last-page'

describe('last-page — mémorisation de la dernière page des Réglages (lot 2)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('retourne null quand rien n’a encore été ouvert', () => {
    expect(getLastSettingsPage()).toBeNull()
  })

  it('relit exactement la page enregistrée', () => {
    setLastSettingsPage('timer')
    expect(getLastSettingsPage()).toBe('timer')
  })

  it('ignore une valeur stockée qui ne correspond à aucune page connue', () => {
    window.localStorage.setItem('flowquest.settingsLastPage', 'page-inconnue')
    expect(getLastSettingsPage()).toBeNull()
  })
})
