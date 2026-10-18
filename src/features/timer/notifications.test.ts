import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as alertSounds from './alert-sounds'
import { notifySegmentFinished } from './notifications'

const BASE_ALERTS = {
  soundEnabled: true,
  notificationsEnabled: true,
  alertSoundId: 'carillon',
  alertVolume: 0.6,
}

describe('notifySegmentFinished — toggles son/notifications indépendants (lot 4)', () => {
  let playAlertSoundSpy: ReturnType<typeof vi.spyOn>
  let notificationSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    playAlertSoundSpy = vi.spyOn(alertSounds, 'playAlertSound').mockImplementation(() => {})
    notificationSpy = vi.fn()
    vi.stubGlobal(
      'Notification',
      Object.assign(notificationSpy, { permission: 'granted' as NotificationPermission }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('joue le son et affiche une notification quand les deux sont activés', () => {
    notifySegmentFinished('focus', BASE_ALERTS)
    expect(playAlertSoundSpy).toHaveBeenCalledWith('carillon', 0.6)
    expect(notificationSpy).toHaveBeenCalled()
  })

  it('son désactivé : pas de lecture, notification toujours affichée', () => {
    notifySegmentFinished('focus', { ...BASE_ALERTS, soundEnabled: false })
    expect(playAlertSoundSpy).not.toHaveBeenCalled()
    expect(notificationSpy).toHaveBeenCalled()
  })

  it('notifications désactivées : pas de notification, son toujours joué', () => {
    notifySegmentFinished('focus', { ...BASE_ALERTS, notificationsEnabled: false })
    expect(playAlertSoundSpy).toHaveBeenCalled()
    expect(notificationSpy).not.toHaveBeenCalled()
  })

  it('tout désactivé : ni son ni notification', () => {
    notifySegmentFinished('focus', { ...BASE_ALERTS, soundEnabled: false, notificationsEnabled: false })
    expect(playAlertSoundSpy).not.toHaveBeenCalled()
    expect(notificationSpy).not.toHaveBeenCalled()
  })
})
