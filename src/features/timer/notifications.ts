import { strings } from '@/shared/i18n'

import type { SegmentKind } from './engine/timer-engine'

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

function playChime(): void {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const now = ctx.currentTime

    for (const [frequency, start] of [
      [880, 0],
      [1320, 0.12],
    ] as const) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.2, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.3)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(now + start)
      oscillator.stop(now + start + 0.32)
    }

    window.setTimeout(() => void ctx.close(), 800)
  } catch {
    // Web Audio indisponible : pas d'alerte sonore, le titre d'onglet reste la seule alerte.
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

export function notifySegmentFinished(segment: SegmentKind): void {
  const message = segmentFinishedMessage(segment)

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(strings.app.name, { body: message })
  } else if (document.visibilityState !== 'visible') {
    flashTitle(`⏰ ${message}`)
  }

  playChime()
}
