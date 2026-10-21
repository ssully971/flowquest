import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearAllLocalStorage } from './clear-local-storage'

describe('clearAllLocalStorage — dernier recours pour un appareil bloqué (LOT E9)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('vide localStorage et sessionStorage', async () => {
    window.localStorage.setItem('flowquest.appearance', 'dark')
    window.sessionStorage.setItem('flowquest.authGateDismissed', 'true')

    await clearAllLocalStorage()

    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('désenregistre les Service Workers et vide le Cache Storage', async () => {
    const unregister = vi.fn().mockResolvedValue(true)
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }])
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: { getRegistrations },
      configurable: true,
    })

    const cachesDelete = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['workbox-precache']), delete: cachesDelete })

    await clearAllLocalStorage()

    expect(getRegistrations).toHaveBeenCalled()
    expect(unregister).toHaveBeenCalled()
    expect(cachesDelete).toHaveBeenCalledWith('workbox-precache')
  })

  it('ne jette pas si serviceWorker/caches sont indisponibles (navigateur plus ancien)', async () => {
    Object.defineProperty(window.navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    })
    vi.stubGlobal('caches', undefined)

    await expect(clearAllLocalStorage()).resolves.toBeUndefined()
  })
})
