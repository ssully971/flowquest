import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  CLOCK_SIZE_SCALE,
  CLOCK_STYLE_CSS,
  resolveClockColor,
} from '@/features/home/clock-settings'
import { useFeatureAccess } from '@/features/access/useFeatureAccess'
import { FeatureGate } from '@/features/feature-flags/FeatureGate'
import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { useQuotesSettings } from '@/features/home/quotes-settings-context'
import { useQuotePool } from '@/features/home/useQuotePool'
import { PillarSelector } from '@/features/pillars/components/PillarSelector'
import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import { GroupEndedPanel } from '@/features/rooms/components/GroupEndedPanel'
import { GroupSessionBody } from '@/features/rooms/components/GroupSessionBody'
import { groupCycleProgress } from '@/features/rooms/room-timer'
import { isIOSDevice } from '@/features/pwa/platform'
import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { useAuth } from '@/features/auth/useAuth'
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
import { buildGroupClockSource, buildSoloClockSource } from './clock-source'
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
  const group = useActiveGroupRoom()
  const { user } = useAuth()
  const { isLocked } = useFeatureAccess()
  const { activeTaskId } = useActiveTask()
  const { tasks } = useTasks()
  const { settings: timerSettings } = useTimerSettings()
  const { settings: clockSettings } = useClockSettings()
  const { settings: quotesSettings } = useQuotesSettings()
  const { settings: extrasSettings } = useExtrasSettings()
  const quotePool = useQuotePool()

  // Une seule horloge à l'écran (LOT M3) : pendant une session de groupe, c'est l'état du
  // salon (source serveur) qui prend la place du minuteur personnel — même emplacement,
  // même style. Tout ce qui suit (citations, titre d'onglet, image dans l'image, Deep
  // Focus...) ne lit que `source`, donc fonctionne à l'identique dans les deux cas.
  const groupSource = buildGroupClockSource(group)
  const isGroup = groupSource !== null
  const source = groupSource ?? buildSoloClockSource(timer, timerSettings)

  const quote = usePhaseQuote(quotesSettings.category, quotePool, source.phaseKey)
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)
  const { showToast } = useToast()
  const resolvedTheme = useResolvedTheme()
  useWakeLock(extrasSettings.preventSleep && source.status === 'running')
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null

  // Le minuteur personnel ne tourne jamais en parallèle d'une session de groupe : s'il
  // tournait, il est mis en pause (il reprendra à la main quand la session sera finie).
  const soloStatus = timer.snapshot?.status
  const pauseSolo = timer.pause
  useEffect(() => {
    if (isGroup && soloStatus === 'running') pauseSolo()
  }, [isGroup, soloStatus, pauseSolo])

  // Deep Focus (LOT G2) : jamais sur le chronomètre libre — seulement une phase de FOCUS
  // du Pomodoro. Volontairement indépendant du statut running/paused (voir
  // useDeepFocus.ts) : sinon la pause déclenchée par ce hook désinstallerait son propre
  // écouteur avant que le toast de reprise n'ait pu se déclencher au retour. Session de
  // groupe : même mise en page minimale, mais jamais de pause automatique (l'horloge est
  // celle de tout le groupe, seul l'hôte peut la mettre en pause).
  const deepFocusFlagEnabled = useFeatureFlag('deep_focus')
  // Verrouillé pour un invité : se comporte comme désactivé, sans toucher au réglage stocké.
  const isDeepFocusEligible =
    timerSettings.deepFocusEnabled &&
    !isLocked('deepFocus') &&
    deepFocusFlagEnabled &&
    source.mode === 'pomodoro' &&
    source.segment === 'focus'

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

  useEffect(() => {
    if (timer.cycleEnded && timerSettings.confettiEnabled) fireSessionEndConfetti()
  }, [timer.cycleEnded, timerSettings.confettiEnabled])

  const isStopwatch = source.isStopwatch
  const displayLabel = source.displayLabel
  useLiveTabTitle(displayLabel, source.status === 'running')
  const pip = usePictureInPicture({
    segmentLabel: getSegmentLabel(source.segment),
    timeLabel: displayLabel,
    taskLabel: timerSettings.showTaskInPip ? activeTask?.title : null,
  })

  const handlePrimary = source.onPrimary

  useKeyboardShortcuts(
    {
      onPrimary: handlePrimary,
      onNext: isGroup ? () => undefined : timer.skip,
      onReset: isGroup ? () => undefined : timer.reset,
      onOpenHelp: () => setIsShortcutsHelpOpen(true),
    },
    timerSettings.keyboardShortcutsEnabled,
  )

  if (!isGroup && !source.isReady) {
    return <div className="h-full" />
  }

  const progress = source.progress
  const snapshot = { status: source.status }
  const goalTarget =
    source.mode === 'pomodoro'
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
          <div style={{ fontSize: 14, opacity: 0.7 }}>{getSegmentLabel(source.segment)}</div>
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
    (isGroup || (!timer.cycleEnded && !timer.goalReached))

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
          onEndSession={isGroup ? () => void group.actions.end() : timer.endSession}
          readOnly={source.readOnly}
        />
        {pipPortal}
        <KeyboardShortcutsHelp
          open={isShortcutsHelpOpen}
          onClose={() => setIsShortcutsHelpOpen(false)}
        />
      </>
    )
  }

  const face = (
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
  )

  // Repères du cycle Pomodoro d'un salon (pastilles + objectif), dérivés de la phase.
  const groupRoom = group.room
  const groupView = group.view
  const groupCycle =
    groupRoom && groupView
      ? groupCycleProgress(groupView.phaseIndex, groupView.phase, groupRoom.sessionsBeforeLongBreak)
      : null
  const cycleNode =
    groupRoom && groupView && groupCycle ? (
      <>
        <SessionTally
          total={groupRoom.sessionsBeforeLongBreak ?? 4}
          completed={groupCycle.completedInCycle}
          currentIsFocus={groupView.phase === 'focus'}
          iconSet={timerSettings.tallyIconSet}
        />
        {goalTarget > 0 ? (
          <div className="hidden sm:block">
            <GoalProgress completed={groupCycle.completedTotal} target={goalTarget} />
          </div>
        ) : null}
      </>
    ) : null

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
              <FeatureGate flag="pillars">
                <PillarSelector disabled={isGroup ? false : timer.isSegmentSwitchBlocked} />
              </FeatureGate>
            ) : null}
          </div>
        </div>

        {quotesSettings.showOnFocus ? (
          <div className="hidden sm:block">
            <FadingQuote quote={quote} />
          </div>
        ) : null}

        {isGroup ? null : (
          <div className="hidden sm:block">
            <SegmentedControl
              ariaLabel={strings.focus.mode}
              value={timer.mode}
              onChange={timer.selectMode}
              options={MODE_OPTIONS}
              variant="glass"
            />
          </div>
        )}

        {isGroup ? (
          <GroupSessionBody
            group={group}
            currentUserId={user?.id ?? null}
            face={face}
            cycle={cycleNode}
            pip={{ toggle: pip.toggle, isSupported: pip.isSupported, show: !isIOSDevice() }}
          />
        ) : group.endedRoom ? (
          <GroupEndedPanel onClose={group.dismissEnded} />
        ) : timer.mode === 'pomodoro' && timer.cycleEnded ? (
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
                {face}

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
