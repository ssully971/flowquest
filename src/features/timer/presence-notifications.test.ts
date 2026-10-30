import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as alertSounds from './alert-sounds'
import { notifyPresenceCheck } from './notifications'

const ALERTS = {
  soundEnabled: true,
  notificationsEnabled: true,
  alertSoundId: 'carillon',
  alertVolume: 0.4,
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
}

describe('notifyPresenceCheck — alerte « Tu es toujours là ? »', () => {
  let guardSpy: ReturnType<typeof vi.spyOn>
  let notificationSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    guardSpy = vi.spyOn(alertSounds, 'playGuardAlert').mockResolvedValue(true)
    notificationSpy = vi.fn()
    vi.stubGlobal(
      'Notification',
      Object.assign(notificationSpy, { permission: 'granted' as NotificationPermission }),
    )
    setVisibility('visible')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setVisibility('visible')
  })

  it('joue le son dédié au volume réglé ; onglet visible : pas de notification système', async () => {
    expect(await notifyPresenceCheck(ALERTS)).toBe(false)
    expect(guardSpy).toHaveBeenCalledWith(0.4)
    expect(notificationSpy).not.toHaveBeenCalled()
  })

  it('onglet masqué : notification système en plus du son', async () => {
    setVisibility('hidden')
    await notifyPresenceCheck(ALERTS)
    expect(guardSpy).toHaveBeenCalled()
    expect(notificationSpy).toHaveBeenCalledWith(expect.any(String), {
      body: 'Tu es toujours là ? Ton minuteur t’attend.',
    })
  })

  it('respecte le réglage de son : son coupé = aucune lecture', async () => {
    await notifyPresenceCheck({ ...ALERTS, soundEnabled: false })
    expect(guardSpy).not.toHaveBeenCalled()
  })

  it('son bloqué par le navigateur : renvoie true et repli visuel (titre de l’onglet)', async () => {
    guardSpy.mockResolvedValue(false)
    const titleBefore = document.title
    expect(await notifyPresenceCheck(ALERTS)).toBe(true)
    expect(document.title).toContain('Tu es toujours là ?')
    expect(document.title).not.toBe(titleBefore)
  })

  it('notifications coupées et onglet masqué : repli par le titre de l’onglet', async () => {
    setVisibility('hidden')
    await notifyPresenceCheck({ ...ALERTS, notificationsEnabled: false })
    expect(notificationSpy).not.toHaveBeenCalled()
    expect(document.title).toContain('Tu es toujours là ?')
  })
})

describe('playGuardAlert / primeGuardAlertAudio — déblocage audio mobile', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renvoie true quand la lecture démarre, au volume demandé (borné)', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    expect(await alertSounds.playGuardAlert(2)).toBe(true)
    expect(play).toHaveBeenCalled()
  })

  it('renvoie false (jamais d’exception) quand le navigateur refuse la lecture', async () => {
    vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockRejectedValue(
      new Error('NotAllowedError'),
    )
    expect(await alertSounds.playGuardAlert(0.5)).toBe(false)
  })

  it('primeGuardAlertAudio amorce le lecteur muet puis l’arrête (lecture permise plus tard sans geste)', async () => {
    const play = vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const pause = vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    alertSounds.primeGuardAlertAudio()
    await Promise.resolve()
    await Promise.resolve()
    expect(play).toHaveBeenCalled()
    expect(pause).toHaveBeenCalled()
  })

  it('le fichier dédié est bien servi depuis public/sounds/alerts/alerte-4h.mp3', () => {
    expect(alertSounds.GUARD_ALERT_SRC).toBe('/sounds/alerts/alerte-4h.mp3')
  })
})
