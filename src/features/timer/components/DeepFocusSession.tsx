import { Pause, Play, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { CLOCK_SIZE_SCALE, CLOCK_STYLE_CSS } from '@/features/home/clock-settings'
import type { ClockSettings } from '@/features/home/clock-settings'
import { strings } from '@/shared/i18n'

import type { TimerStatus } from '../engine/timer-engine'
import type { TimerDisplayStyle } from '../timer-display-style'
import { TimerFace } from './TimerFace'

const INACTIVITY_MS = 3000

interface DeepFocusSessionProps {
  theme: 'dark' | 'light'
  displayLabel: string
  displayStyle: TimerDisplayStyle
  progress: number
  clockSize: ClockSettings['size']
  clockStyle: ClockSettings['style']
  status: TimerStatus
  onPrimary: () => void
  onEndSession: () => void
}

/**
 * Mise en page Deep Focus (lot 3 bis, §6) : rien à l'écran que le temps et deux boutons, sur
 * un vrai noir/blanc pur (pas les jetons --bg du thème, souvent teintés) — aucune citation,
 * aucune barre du bas, aucun fond d'écran. `fixed inset-0` + z-index élevé pour recouvrir
 * entièrement AppShell, y compris sa barre du bas (même principe de prise d'écran complète
 * que RoomScreen).
 */
export function DeepFocusSession({
  theme,
  displayLabel,
  displayStyle,
  progress,
  clockSize,
  clockStyle,
  status,
  onPrimary,
  onEndSession,
}: DeepFocusSessionProps) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const timeoutRef = useRef<number | null>(null)

  // S'estompent après 3 s d'inactivité, réapparaissent au toucher (§6) : un seul minuteur
  // d'inactivité réarmé à chaque geste (pointeur ou clavier), jamais un par bouton.
  useEffect(() => {
    const scheduleHide = () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      timeoutRef.current = window.setTimeout(() => setControlsVisible(false), INACTIVITY_MS)
    }
    const handleActivity = () => {
      setControlsVisible(true)
      scheduleHide()
    }
    scheduleHide()
    window.addEventListener('pointermove', handleActivity)
    window.addEventListener('pointerdown', handleActivity)
    window.addEventListener('keydown', handleActivity)
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
      window.removeEventListener('pointermove', handleActivity)
      window.removeEventListener('pointerdown', handleActivity)
      window.removeEventListener('keydown', handleActivity)
    }
  }, [])

  const isDark = theme === 'dark'
  const bg = isDark ? '#000000' : '#ffffff'
  const fg = isDark ? '#ffffff' : '#000000'
  const isRunning = status === 'running'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning ? strings.focus.controls.pause : strings.focus.controls.resume

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-10"
      // --accent est aussi redéfini : le séparateur « : » de BigDigits l'utilise en dur
      // (accent de marque, voulu partout ailleurs) — ici rien d'autre que du noir/blanc pur
      // ne doit rester visible, le séparateur y compris.
      style={{ background: bg, color: fg, ['--accent' as string]: fg }}
    >
      <div role="timer" aria-label={`${strings.focus.timeRemaining} : ${displayLabel}`}>
        <TimerFace
          style={displayStyle}
          label={displayLabel}
          progress={progress}
          sizeScale={CLOCK_SIZE_SCALE[clockSize]}
          color={fg}
          styleCss={CLOCK_STYLE_CSS[clockStyle]}
        />
      </div>

      <div
        className="flex items-center gap-6 transition-opacity duration-500"
        style={{
          opacity: controlsVisible ? 1 : 0,
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        <button
          type="button"
          aria-label={primaryLabel}
          onClick={onPrimary}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full border transition-transform duration-200 hover:scale-105"
          style={{ borderColor: fg, color: fg }}
        >
          <PrimaryIcon
            size={26}
            strokeWidth={1.75}
            aria-hidden="true"
            fill={isRunning ? 'none' : 'currentColor'}
          />
        </button>
        <button
          type="button"
          aria-label={strings.focus.controls.endSession}
          onClick={onEndSession}
          className="inline-flex h-16 w-16 items-center justify-center rounded-full border transition-transform duration-200 hover:scale-105"
          style={{ borderColor: fg, color: fg }}
        >
          <Square size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
