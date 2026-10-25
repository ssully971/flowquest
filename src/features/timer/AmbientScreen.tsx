import { Music, Pause, Play } from 'lucide-react'
import { useState } from 'react'

import { AmbientSoundsPanel } from '@/features/ambient/components/AmbientSoundsPanel'
import { useAmbientSounds } from '@/features/ambient/useAmbientSounds'
import { CLOCK_SIZE_SCALE, CLOCK_STYLE_CSS, resolveClockColor } from '@/features/home/clock-settings'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { BigDigits, GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { formatCountdown } from './format'
import { useFocusTimer } from './useFocusTimer'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useTimerSettings } from './timer-settings-context'

const AMBIENT_CLOCK_BASE_PX = 72

/** §5.3 : fond plein cadre (géré par AppShell), minuteur compact en carte Liquid Glass
 * — en haut à droite sur ordinateur, centré en haut sur mobile (LOT C2) — le reste de
 * l'écran libre. On réutilise le minuteur Focus existant ; la taille et la couleur de
 * l'horloge suivent Réglages > Horloge, comme sur l'accueil et le Focus. */
export function AmbientScreen() {
  const timer = useFocusTimer()
  const sounds = useAmbientSounds()
  const { settings: clockSettings } = useClockSettings()
  const { settings: timerSettings } = useTimerSettings()
  const [isSoundsOpen, setIsSoundsOpen] = useState(false)
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)

  const handlePrimary = () => {
    const status = timer.snapshot?.status
    if (status === 'running') timer.pause()
    else if (status === 'paused') timer.resume()
    else timer.start()
  }

  useKeyboardShortcuts(
    {
      onPrimary: handlePrimary,
      onNext: timer.skip,
      onReset: timer.reset,
      onToggleMute: sounds.toggleMute,
      onOpenHelp: () => setIsShortcutsHelpOpen(true),
    },
    timerSettings.keyboardShortcutsEnabled,
  )

  if (!timer.isReady || !timer.snapshot) {
    return <div className="h-full" />
  }

  const { snapshot } = timer
  const displayLabel = formatCountdown(snapshot.remainingMs ?? 0)
  const isRunning = snapshot.status === 'running'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning
    ? strings.focus.controls.pause
    : snapshot.status === 'paused'
      ? strings.focus.controls.resume
      : strings.focus.controls.start

  return (
    <div className="relative h-full">
      <div className="absolute inset-x-0 top-[max(2rem,env(safe-area-inset-top))] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-14 sm:top-[max(4rem,env(safe-area-inset-top))] sm:items-end sm:px-0">
        <GlassCard className="flex items-center gap-3 rounded-2xl px-4 py-2.5">
          <BigDigits
            label={displayLabel}
            sizePx={AMBIENT_CLOCK_BASE_PX}
            sizeScale={CLOCK_SIZE_SCALE[clockSettings.size]}
            color={resolveClockColor(clockSettings.color)}
            fontFamily={CLOCK_STYLE_CSS[clockSettings.style].fontFamily}
            fontWeight={CLOCK_STYLE_CSS[clockSettings.style].fontWeight}
            letterSpacing={CLOCK_STYLE_CSS[clockSettings.style].letterSpacing}
            fontStyle={CLOCK_STYLE_CSS[clockSettings.style].fontStyle}
          />
          <button
            type="button"
            aria-label={primaryLabel}
            onClick={handlePrimary}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105"
          >
            <PrimaryIcon
              size={18}
              strokeWidth={1.75}
              aria-hidden="true"
              fill={isRunning ? 'none' : 'currentColor'}
            />
          </button>
        </GlassCard>

        <div className="relative">
          <button
            type="button"
            aria-label={strings.ambient.soundsButton}
            aria-expanded={isSoundsOpen}
            onClick={() => setIsSoundsOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            style={{
              borderColor: 'var(--line)',
              background: sounds.activeIds.length > 0 ? 'var(--accent)' : 'var(--surface)',
              color: sounds.activeIds.length > 0 ? 'var(--on-accent)' : 'var(--text)',
            }}
          >
            <Music size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <AmbientSoundsPanel
            open={isSoundsOpen}
            onClose={() => setIsSoundsOpen(false)}
            {...sounds}
          />
        </div>
      </div>

      <KeyboardShortcutsHelp open={isShortcutsHelpOpen} onClose={() => setIsShortcutsHelpOpen(false)} />
    </div>
  )
}
