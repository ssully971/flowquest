import { Pause, Play } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useFeatureAccess } from '@/features/access/useFeatureAccess'
import { AmbientSoundsControl } from '@/features/ambient/components/AmbientSoundsControl'
import { useAmbientSounds } from '@/features/ambient/useAmbientSounds'
import {
  CLOCK_SIZE_SCALE,
  CLOCK_STYLE_CSS,
  resolveClockColor,
} from '@/features/home/clock-settings'
import { DEFAULT_AMBIENT_POSITIONS } from '@/features/home/clock-position'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import { GroupConnecting } from '@/features/rooms/components/GroupConnecting'
import { BigDigits } from '@/shared/design-system'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { DeepFocusIndicator } from './components/DeepFocusIndicator'
import { DraggableCluster } from './components/DraggableCluster'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { TimerGuardLayer } from './components/TimerGuardLayer'
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
  const { isLocked } = useFeatureAccess()
  const soundsLocked = isLocked('ambientSounds')
  const { settings: clockSettings, setSettings: setClockSettings } = useClockSettings()
  const { settings: timerSettings } = useTimerSettings()
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
      // Sons verrouillés (invité) : la touche M ne fait rien.
      onToggleMute: soundsLocked ? undefined : sounds.toggleMute,
      onOpenHelp: () => setIsShortcutsHelpOpen(true),
    },
    timerSettings.keyboardShortcutsEnabled,
  )

  // Deep Focus (LOT G2) : mêmes conditions que sur l'écran Focus (voir son commentaire
  // pour le choix de garder `enabled` indépendant du statut running/paused).
  const isDeepFocusEligible =
    timerSettings.deepFocusEnabled &&
    !isLocked('deepFocus') &&
    source.mode === 'pomodoro' &&
    source.segment === 'focus'
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

  if (!isGroup && group.connecting) {
    return (
      <GroupConnecting room={group.connecting} error={group.loadError} onRetry={group.retryLoad} />
    )
  }

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
      <DraggableCluster
        positions={clockSettings.ambientPositions}
        onChange={(key, position) =>
          setClockSettings({
            ...clockSettings,
            ambientPositions: {
              ...(clockSettings.ambientPositions ?? DEFAULT_AMBIENT_POSITIONS),
              [key]: position,
            },
          })
        }
      >
        {(grip) => (
          <>
            <div className="glass-clock flex items-center gap-3 rounded-2xl px-3 py-2.5 pr-4">
              {grip}
              <span
                className={`glass-clock-text ${clockSettings.glassDigits === true ? 'glass-clock-text-glass' : ''}`}
              >
                <BigDigits
                  label={displayLabel}
                  sizePx={AMBIENT_CLOCK_BASE_PX}
                  sizeScale={CLOCK_SIZE_SCALE[clockSettings.size]}
                  color={resolveClockColor(clockSettings.color)}
                  fontFamily={CLOCK_STYLE_CSS[clockSettings.style].fontFamily}
                  fontWeight={CLOCK_STYLE_CSS[clockSettings.style].fontWeight}
                  letterSpacing={CLOCK_STYLE_CSS[clockSettings.style].letterSpacing}
                  fontStyle={CLOCK_STYLE_CSS[clockSettings.style].fontStyle}
                  glass={clockSettings.glassDigits === true}
                />
              </span>
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
            </div>

            {isDeepFocusActive ? <DeepFocusIndicator /> : null}
          </>
        )}
      </DraggableCluster>

      {/* Bouton FIXE (comme les autres boutons de l'écran) : ne suit pas l'horloge déplacée. */}
      <div
        data-testid="ambient-sounds-anchor"
        className="absolute bottom-24 right-4 z-10 sm:right-14"
      >
        <AmbientSoundsControl sounds={sounds} direction="up" />
      </div>

      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
      <TimerGuardLayer timer={timer} />
    </div>
  )
}
