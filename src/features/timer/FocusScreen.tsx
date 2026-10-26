import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  CLOCK_SIZE_SCALE,
  CLOCK_STYLE_CSS,
  resolveClockColor,
} from '@/features/home/clock-settings'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { useQuotesSettings } from '@/features/home/quotes-settings-context'
import { useQuotePool } from '@/features/home/useQuotePool'
import { PillarSelector } from '@/features/pillars/components/PillarSelector'
import { isIOSDevice } from '@/features/pwa/platform'
import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { useActiveTask } from '@/features/tasks/active-task-context'
import { useTasks } from '@/features/tasks/useTasks'
import { Logo, SegmentedControl, useResolvedTheme } from '@/shared/design-system'
import { useWakeLock } from '@/shared/hooks/useWakeLock'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import type { SegmentKind, TimerMode } from './engine/timer-engine'
import { DeepFocusSession } from './components/DeepFocusSession'
import { FadingQuote } from './components/FadingQuote'
import { GoalProgress } from './components/GoalProgress'
import { GoalReachedPanel } from './components/GoalReachedPanel'
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp'
import { SegmentTabs } from './components/SegmentTabs'
import { SessionEndScreen } from './components/SessionEndScreen'
import { SessionTally } from './components/SessionTally'
import { TimerControls } from './components/TimerControls'
import { TimerFace } from './components/TimerFace'
import { useDeepFocus } from './useDeepFocus'
import { getDurationMsForMode } from './durations'
import { formatCountdown, formatElapsed } from './format'
import { fireSessionEndConfetti } from './session-end-confetti'
import { getGoalFocusSessions } from './session-goal'
import { toDurationsMs } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'
import { useFocusTimer } from './useFocusTimer'
import { useKeyboardShortcuts } from './useKeyboardShortcuts'
import { useLiveTabTitle } from './useLiveTabTitle'
import { usePhaseQuote } from './usePhaseQuote'
import { usePictureInPicture } from './usePictureInPicture'

const MODE_OPTIONS: { value: TimerMode; label: string }[] = [
  { value: 'pomodoro', label: strings.focus.modes.pomodoro },
  { value: 'countdown', label: strings.focus.modes.countdown },
  { value: 'stopwatch', label: strings.focus.modes.stopwatch },
]

function getSegmentLabel(segment: SegmentKind): string {
  switch (segment) {
    case 'short_break':
      return strings.focus.tabs.shortBreak
    case 'long_break':
      return strings.focus.tabs.longBreak
    case 'countdown':
      return strings.focus.modes.countdown
    case 'stopwatch':
      return strings.focus.modes.stopwatch
    default:
      return strings.focus.tabs.focus
  }
}

export function FocusScreen() {
  const timer = useFocusTimer()
  const { activeTaskId } = useActiveTask()
  const { tasks } = useTasks()
  const { settings: timerSettings } = useTimerSettings()
  const { settings: clockSettings } = useClockSettings()
  const { settings: quotesSettings } = useQuotesSettings()
  const { settings: extrasSettings } = useExtrasSettings()
  const quotePool = useQuotePool()
  const phaseKey = timer.startedAt !== null ? `${timer.segment}:${timer.startedAt}` : null
  const quote = usePhaseQuote(quotesSettings.category, quotePool, phaseKey)
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)
  const { showToast } = useToast()
  const resolvedTheme = useResolvedTheme()
  useWakeLock(extrasSettings.preventSleep && timer.snapshot?.status === 'running')
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null

  // Deep Focus (LOT G2) : jamais sur le chronomètre libre — seulement une phase de FOCUS
  // du Pomodoro. Volontairement indépendant du statut running/paused (voir
  // useDeepFocus.ts) : sinon la pause déclenchée par ce hook désinstallerait son propre
  // écouteur avant que le toast de reprise n'ait pu se déclencher au retour.
  const isDeepFocusEligible =
    timerSettings.deepFocusEnabled && timer.mode === 'pomodoro' && timer.segment === 'focus'

  useDeepFocus({
    enabled: isDeepFocusEligible,
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

  useEffect(() => {
    if (timer.cycleEnded && timerSettings.confettiEnabled) fireSessionEndConfetti()
  }, [timer.cycleEnded, timerSettings.confettiEnabled])

  const isStopwatch = timer.mode === 'stopwatch'
  const displayLabel = isStopwatch
    ? formatElapsed(timer.snapshot?.elapsedMs ?? 0)
    : formatCountdown(timer.snapshot?.remainingMs ?? 0)
  useLiveTabTitle(displayLabel, timer.snapshot?.status === 'running')
  const pip = usePictureInPicture({
    segmentLabel: getSegmentLabel(timer.segment),
    timeLabel: displayLabel,
    taskLabel: timerSettings.showTaskInPip ? activeTask?.title : null,
  })

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
      onOpenHelp: () => setIsShortcutsHelpOpen(true),
    },
    timerSettings.keyboardShortcutsEnabled,
  )

  if (!timer.isReady || !timer.snapshot) {
    return <div className="h-full" />
  }

  const { snapshot } = timer
  const durationMs = getDurationMsForMode(
    timer.mode,
    timer.segment,
    toDurationsMs(timerSettings),
    timerSettings.countdownMinutes * 60_000,
  )
  const progress =
    durationMs !== null && durationMs > 0 ? Math.min(1, snapshot.elapsedMs / durationMs) : 0
  const goalTarget =
    timer.mode === 'pomodoro'
      ? getGoalFocusSessions({
          goalType: timerSettings.sessionGoalType,
          goalCount: timerSettings.sessionGoalCount,
          goalMinutes: timerSettings.sessionGoalMinutes,
          durations: toDurationsMs(timerSettings),
          sessionsBeforeLongBreak: timerSettings.sessionsBeforeLongBreak,
        })
      : 0

  const pipPortal = pip.pipWindow
    ? createPortal(
        <div
          style={{
            fontFamily: 'sans-serif',
            background: '#0c0719',
            color: '#f2ecfc',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.7 }}>{getSegmentLabel(timer.segment)}</div>
          <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {displayLabel}
          </div>
          {timerSettings.showTaskInPip && activeTask ? (
            <div style={{ fontSize: 12, opacity: 0.6, maxWidth: '90%', textAlign: 'center' }}>
              {activeTask.title}
            </div>
          ) : null}
        </div>,
        pip.pipWindow.document.body,
      )
    : null

  // Mise en page Deep Focus (lot 3 bis, §6) : remplace entièrement l'écran normal (pas
  // seulement un badge) une fois la session démarrée — jamais avant (l'écran « Sur quoi
  // veux-tu te concentrer ? » et le bouton Lancer restent visibles tant que rien n'a
  // commencé), y compris pendant une pause déclenchée manuellement ou par Deep Focus
  // lui-même, pour ne pas faire clignoter la mise en page en basculant pause/reprise.
  // Jamais pendant l'écran de fin de session ou le palier d'objectif atteint, qui ont
  // besoin de leurs propres actions.
  const isDeepFocusLayoutActive =
    isDeepFocusEligible &&
    (snapshot.status === 'running' || snapshot.status === 'paused') &&
    !timer.cycleEnded &&
    !timer.goalReached

  if (isDeepFocusLayoutActive) {
    return (
      <>
        <DeepFocusSession
          theme={resolvedTheme}
          displayLabel={displayLabel}
          displayStyle={timerSettings.displayStyle}
          progress={progress}
          clockSize={clockSettings.size}
          clockStyle={clockSettings.style}
          status={snapshot.status}
          onPrimary={handlePrimary}
          onEndSession={timer.endSession}
        />
        {pipPortal}
        <KeyboardShortcutsHelp
          open={isShortcutsHelpOpen}
          onClose={() => setIsShortcutsHelpOpen(false)}
        />
      </>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto">
      {/* LOT H2, §5 (retour après feu vert) : logo + citation ancrés en haut sur mobile,
          comme l'accueil (HomeScreen) — pas au milieu d'un bloc centré, pour rester
          aussi aéré que l'accueil. Desktop inchangé : logo absent, citation à sa place
          habituelle dans le bloc centré ci-dessous (voir plus bas, `sm:block`). */}
      <div className="absolute inset-x-0 top-0 flex flex-col items-center gap-2 px-6 pt-[max(2rem,env(safe-area-inset-top))] text-center sm:hidden">
        <Logo className="h-8 w-auto" />
        {quotesSettings.showOnFocus ? <FadingQuote quote={quote} /> : null}
      </div>

      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-8 pb-24 text-center sm:gap-7 sm:pb-28">
        {/* LOT H2, §5 : mise en page mobile épurée (logo, citation, titre, icônes de
            mode, horloge, 2 boutons) — la tâche active, le pilier et le mode
            Pomodoro/Compte à rebours/Chronomètre restent une fonctionnalité desktop,
            volontairement absente de cette version mobile simplifiée (voir le
            compte-rendu du lot pour la liste complète de ce qui est masqué). */}
        <div className="w-full">
          <p
            className="text-[28px] font-semibold text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {strings.focus.question}
          </p>
          <div className="mt-1 hidden items-center justify-center gap-1.5 sm:flex">
            <p className="text-sm text-[var(--muted)]">
              {activeTask ? activeTask.title : strings.focus.noActiveTask}
            </p>
            {extrasSettings.pillarsEnabled ? (
              <PillarSelector disabled={timer.isSegmentSwitchBlocked} />
            ) : null}
          </div>
        </div>

        {quotesSettings.showOnFocus ? (
          <div className="hidden sm:block">
            <FadingQuote quote={quote} />
          </div>
        ) : null}

        <div className="hidden sm:block">
          <SegmentedControl
            ariaLabel={strings.focus.mode}
            value={timer.mode}
            onChange={timer.selectMode}
            options={MODE_OPTIONS}
          />
        </div>

        {timer.mode === 'pomodoro' && timer.cycleEnded ? (
          <SessionEndScreen
            summary={timer.sessionSummary}
            showSummary={timerSettings.sessionSummaryEnabled}
            pillarLevelUp={timer.pillarLevelUp}
            onAcknowledge={timer.acknowledgeSessionEnd}
          />
        ) : (
          <>
            {timer.mode === 'pomodoro' ? (
              <>
                <SegmentTabs
                  value={timer.segment}
                  onChange={timer.selectSegment}
                  disabled={timer.isSegmentSwitchBlocked}
                />

                <SessionTally
                  total={timerSettings.sessionsBeforeLongBreak}
                  completed={timer.cycle.completedFocusCount}
                  currentIsFocus={timer.segment === 'focus'}
                  iconSet={timerSettings.tallyIconSet}
                />

                {goalTarget > 0 ? (
                  <div className="hidden sm:block">
                    <GoalProgress completed={timer.goalProgress} target={goalTarget} />
                  </div>
                ) : null}
              </>
            ) : null}

            {timer.mode === 'pomodoro' && timer.goalReached ? (
              <GoalReachedPanel
                completed={timer.goalProgress}
                onContinue={timer.continueAfterGoal}
              />
            ) : (
              <>
                <div
                  role="timer"
                  aria-label={`${isStopwatch ? strings.focus.timeElapsed : strings.focus.timeRemaining} : ${displayLabel}`}
                >
                  <TimerFace
                    style={timerSettings.displayStyle}
                    label={displayLabel}
                    progress={progress}
                    sizeScale={CLOCK_SIZE_SCALE[clockSettings.size]}
                    color={resolveClockColor(clockSettings.color)}
                    styleCss={CLOCK_STYLE_CSS[clockSettings.style]}
                  />
                </div>

                <TimerControls
                  status={snapshot.status}
                  onReset={timer.reset}
                  onPrimary={handlePrimary}
                  onSkip={timer.skip}
                  showSkip={timer.mode === 'pomodoro'}
                  onEndSession={timer.endSession}
                  showEndSession={timer.mode === 'pomodoro'}
                  onPictureInPicture={pip.toggle}
                  pipAvailable={pip.isSupported}
                  showPip={!isIOSDevice()}
                />
              </>
            )}
          </>
        )}
      </div>

      {pipPortal}

      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onClose={() => setIsShortcutsHelpOpen(false)}
      />
    </div>
  )
}
