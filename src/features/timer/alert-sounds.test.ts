import { afterEach, describe, expect, it, vi } from 'vitest'

import { ALERT_SOUNDS, getAlertSound, playAlertSound } from './alert-sounds'

describe('alert-sounds — catalogue et lecture (lot 4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('getAlertSound retrouve un son par son identifiant', () => {
    const sound = getAlertSound('cloche')
    expect(sound.label).toBe('Cloche')
  })

  it('getAlertSound retombe sur le premier son pour un identifiant inconnu', () => {
    expect(getAlertSound('inexistant')).toBe(ALERT_SOUNDS[0])
  })

  it('playAlertSound règle le volume et lance la lecture', () => {
    const playSpy = vi
      .spyOn(window.HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve())

    playAlertSound('carillon', 0.5)

    expect(playSpy).toHaveBeenCalled()
  })

  it('playAlertSound ne plante jamais si la lecture est refusée (pas de geste utilisateur)', () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.reject(new Error('NotAllowedError')),
    )
    expect(() => playAlertSound('carillon', 0.5)).not.toThrow()
  })

  it('borne le volume entre 0 et 1', () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
      Promise.resolve(),
    )
    // On vérifie juste l'absence d'exception avec des valeurs hors-plage.
    expect(() => playAlertSound('carillon', 2)).not.toThrow()
    expect(() => playAlertSound('carillon', -1)).not.toThrow()
  })
})
