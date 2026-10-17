import { strings } from '@/shared/i18n'

import { playAlertSound } from './alert-sounds'
import type { SegmentKind } from './engine/timer-engine'

export interface AlertPreferences {
  soundEnabled: boolean
  notificationsEnabled: boolean
  alertSoundId: string
  alertVolume: number
}

export function requestNotificationPermission(): void {
  if (typeof Notification === 'undefined') return
  if (Notification.permission !== 'default') return
  void Notification.requestPermission()
}

function segmentFinishedMessage(segment: SegmentKind): string {
  switch (segment) {
    case 'focus':
      return strings.focus.notifications.focusDone
    case 'short_break':
      return strings.focus.notifications.shortBreakDone
    case 'long_break':
      return strings.focus.notifications.longBreakDone
    default:
      return strings.focus.notifications.focusDone
  }
}

let titleFlashTimeoutId: number | null = null
let originalTitle: string | null = null

function flashTitle(message: string): void {
  if (originalTitle === null) originalTitle = document.title
  document.title = message
  if (titleFlashTimeoutId !== null) window.clearTimeout(titleFlashTimeoutId)
  titleFlashTimeoutId = window.setTimeout(() => {
    document.title = originalTitle ?? strings.app.name
    originalTitle = null
    titleFlashTimeoutId = null
  }, 6000)
}

export function notifySegmentFinished(segment: SegmentKind, alerts: AlertPreferences): void {
  const message = segmentFinishedMessage(segment)

  if (alerts.notificationsEnabled) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(strings.app.name, { body: message })
    } else if (document.visibilityState !== 'visible') {
      flashTitle(`⏰ ${message}`)
    }
  }

  if (alerts.soundEnabled) {
    playAlertSound(alerts.alertSoundId, alerts.alertVolume)
  }
}
