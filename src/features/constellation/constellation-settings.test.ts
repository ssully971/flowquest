import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_CONSTELLATION_SETTINGS,
  hasSeenConstellationHint,
  markConstellationHintSeen,
  normalizeSettings,
  readConstellationSettings,
  writeConstellationSettings,
} from './constellation-settings'

describe('constellation-settings', () => {
  beforeEach(() => window.localStorage.clear())

  it('valeurs par défaut : étiquettes auto, tâches à faire et flèches visibles, archivées masquées', () => {
    expect(readConstellationSettings()).toEqual(DEFAULT_CONSTELLATION_SETTINGS)
    expect(DEFAULT_CONSTELLATION_SETTINGS).toMatchObject({
      labels: 'auto',
      showTodo: true,
      showArrows: true,
      showArchived: false,
      nodeScale: 1,
    })
  })

  it('mémorise et relit les réglages', () => {
    writeConstellationSettings({
      ...DEFAULT_CONSTELLATION_SETTINGS,
      labels: 'never',
      nodeScale: 1.3,
    })
    expect(readConstellationSettings()).toMatchObject({ labels: 'never', nodeScale: 1.3 })
  })

  it('ignore les valeurs invalides et borne la taille des nœuds', () => {
    expect(normalizeSettings({ labels: 'x', showTodo: 'oui', nodeScale: 99 })).toEqual({
      ...DEFAULT_CONSTELLATION_SETTINGS,
      nodeScale: 1.6,
    })
    expect(normalizeSettings({ nodeScale: 0.1 }).nodeScale).toBe(0.6)
    expect(normalizeSettings(null)).toEqual(DEFAULT_CONSTELLATION_SETTINGS)
    window.localStorage.setItem('flowquest.constellationSettings', '{pas du json')
    expect(readConstellationSettings()).toEqual(DEFAULT_CONSTELLATION_SETTINGS)
  })

  it('l’aide ne se réaffiche plus une fois vue', () => {
    expect(hasSeenConstellationHint()).toBe(false)
    markConstellationHintSeen()
    expect(hasSeenConstellationHint()).toBe(true)
  })
})
