import { Music, Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { AmbientSoundsPanel } from '@/features/ambient/components/AmbientSoundsPanel'
import { useAmbientSounds } from '@/features/ambient/useAmbientSounds'
import {
  CLOCK_SIZE_SCALE,
  CLOCK_STYLE_CSS,
  resolveClockColor,
} from '@/features/home/clock-settings'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import { BigDigits, GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { DeepFocusIndicator } from './components/DeepFocusIndicator'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { useDeepFocus } from './useDeepFocus'
import { buildGroupClockSource, buildSoloClockSource } from './clock-source'
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
  const group = useActiveGroupRoom()
  const sounds = useAmbientSounds()
  const { settings: clockSettings } = useClockSettings()
  const { settings: timerSettings } = useTimerSettings()
  const [isSoundsOpen, setIsSoundsOpen] = useState(false)
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)
  const { showToast } = useToast()

  // Une seule horloge (LOT M3) : pendant une session de groupe, l'écran Ambiant affiche
  // l'horloge du salon, comme l'écran Focus (voir clock-source.ts).
  const groupSource = buildGroupClockSource(group)
  const isGroup = groupSource !== null
  const source = groupSource ?? buildSoloClockSource(timer, timerSettings)
  const handlePrimary = source.onPrimary

  const soloStatus = timer.snapshot?.status
  const pauseSolo = timer.pause
  useEffect(() => {
    if (isGroup && soloStatus === 'running') pauseSolo()
  }, [isGroup, soloStatus, pauseSolo])

  useKeyboardShortcuts(
    {
      onPrimary: handlePrimary,
      onNext: isGroup ? () => undefined : timer.skip,
      onReset: isGroup ? () => undefined : timer.reset,
      onToggleMute: sounds.toggleMute,
      onOpenHelp: () => setIsShortcutsHelpOpen(true),
    },
    timerSettings.keyboardShortcutsEnabled,
  )

  // Deep Focus (LOT G2) : mêmes conditions que sur l'écran Focus (voir son commentaire
  // pour le choix de garder `enabled` indépendant du statut running/paused).
  const isDeepFocusEligible =
    timerSettings.deepFocusEnabled && source.mode === 'pomodoro' && source.segment === 'focus'
  const isDeepFocusActive = isDeepFocusEligible && source.status === 'running'

  useDeepFocus({
    enabled: isDeepFocusEligible && !isGroup,
    graceMs: timerSettings.deepFocusGraceSeconds * 1000,
    isRunning: () => timer.snapshot?.status === 'running',
    onPause: (hiddenAt) => timer.pause(hiddenAt),
    onPausedWhileAway: () => {
      showToast({
        type: 'info',
        message: strings.focus.deepFocus.pausedToastMessage,
        action: { label: strings.focus.deepFocus.resumeAction, onClick: timer.resume },
      })
    },
  })

  if (!isGroup && !source.isReady) {
    return <div className="h-full" />
  }

  const displayLabel = source.displayLabel
  const isRunning = source.status === 'running'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning
    ? strings.focus.controls.pause
    : source.status === 'paused'
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
          {source.readOnly ? null : (
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
          )}
        </GlassCard>

        <div className="relative">
          <button
            type="button"
            aria-label={strings.ambient.soundsButton}
            aria-expanded={isSoundsOpen}
            onClick={() => setIsSoundsOpen((prev) => !prev)}
            className={
              sounds.activeIds.length > 0
                ? 'inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105'
                : 'glass-pill inline-flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105'
            }
          >
            <Music
              size={18}
              strokeWidth={1.75}
              aria-hidden="true"
              className={sounds.activeIds.length === 0 ? 'glass-pill-icon' : undefined}
            />
          </button>
          <AmbientSoundsPanel
            open={isSoundsOpen}
            onClose={() => setIsSoundsOpen(false)}
            {...sounds}
          />
        </div>

        {isDeepFocusActive ? <DeepFocusIndicator /> : null}
      </div>

      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  )
}
