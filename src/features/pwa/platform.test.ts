import { afterEach, describe, expect, it } from 'vitest'

import { isIOSDevice, isStandaloneDisplayMode } from './platform'

const ORIGINAL_UA = window.navigator.userAgent
const ORIGINAL_MAX_TOUCH_POINTS = window.navigator.maxTouchPoints

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function setMaxTouchPoints(points: number) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: points, configurable: true })
}

describe('platform — détection iOS et mode autonome (§6.2 du cahier des charges)', () => {
  afterEach(() => {
    setUserAgent(ORIGINAL_UA)
    setMaxTouchPoints(ORIGINAL_MAX_TOUCH_POINTS)
    Reflect.deleteProperty(window.navigator, 'standalone')
    Reflect.deleteProperty(window, 'matchMedia')
  })

  it('détecte un iPhone/iPad classique via l’agent utilisateur', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    expect(isIOSDevice()).toBe(true)
  })

  it('détecte un iPad en iPadOS 13+ (UA « Macintosh » + écran tactile)', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15')
    setMaxTouchPoints(5)
    expect(isIOSDevice()).toBe(true)
  })

  it('ne détecte pas un Mac de bureau classique (pas d’écran tactile)', () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15')
    setMaxTouchPoints(0)
    expect(isIOSDevice()).toBe(false)
  })

  it('ne détecte pas Android', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')
    expect(isIOSDevice()).toBe(false)
  })

  it('détecte le mode autonome via navigator.standalone (iOS)', () => {
    Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true })
    expect(isStandaloneDisplayMode()).toBe(true)
  })

  it('détecte le mode autonome via matchMedia (Android/desktop)', () => {
    Object.defineProperty(window, 'matchMedia', {
      value: (query: string) => ({ matches: query.includes('standalone') }),
      configurable: true,
    })
    expect(isStandaloneDisplayMode()).toBe(true)
  })

  it('n’est pas en mode autonome par défaut', () => {
    expect(isStandaloneDisplayMode()).toBe(false)
  })
})
