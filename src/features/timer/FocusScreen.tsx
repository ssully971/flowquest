import { createPortal } from 'react-dom'

import { useQuotesSettings } from '@/features/home/quotes-settings-context'
import { useQuote } from '@/features/home/useQuote'
import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { useActiveTask } from '@/features/tasks/active-task-context'
import { useTasks } from '@/features/tasks/useTasks'
import { SegmentedControl } from '@/shared/design-system'
import { useCurrentTime } from '@/shared/hooks/useCurrentTime'
import { useWakeLock } from '@/shared/hooks/useWakeLock'
import { strings } from '@/shared/i18n'

import type { SegmentKind, TimerMode } from './engine/timer-engine'
import { GoalProgress } from './components/GoalProgress'
import { GoalReachedPanel } from './components/GoalReachedPanel'
import { SegmentTabs } from './components/SegmentTabs'
import { SessionTally } from './components/SessionTally'
import { TimerControls } from './components/TimerControls'
import { TimerFace } from './components/TimerFace'
import { getDurationMsForMode } from './durations'
import { formatCountdown, formatElapsed } from './format'
import { getGoalFocusSessions } from './session-goal'
import { toDurationsMs } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'
import { useFocusTimer } from './useFocusTimer'
import { useLiveTabTitle } from './useLiveTabTitle'
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
  const { settings: quotesSettings } = useQuotesSettings()
  const { settings: extrasSettings } = useExtrasSettings()
  const now = useCurrentTime(60_000)
  const quote = useQuote(now)
  useWakeLock(extrasSettings.preventSleep && timer.snapshot?.status === 'running')
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null

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

  const handlePrimary = () => {
    if (snapshot.status === 'running') timer.pause()
    else if (snapshot.status === 'paused') timer.resume()
    else timer.start()
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 px-4 py-8 pb-24 text-center sm:gap-7 sm:pb-28">
        <div className="w-full">
          <p
            className="text-[28px] font-semibold text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {strings.focus.question}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {activeTask ? activeTask.title : strings.focus.noActiveTask}
          </p>
        </div>

        {quotesSettings.showOnFocus ? (
          <figure className="max-w-sm">
            <blockquote className="text-sm italic text-[var(--muted)]">“{quote.text}”</blockquote>
            <figcaption className="mt-1 text-xs text-[var(--muted)]">{quote.author}</figcaption>
          </figure>
        ) : null}

        <SegmentedControl
          ariaLabel={strings.focus.mode}
          value={timer.mode}
          onChange={timer.selectMode}
          options={MODE_OPTIONS}
        />

        {timer.mode === 'pomodoro' ? (
          <>
            <SegmentTabs value={timer.segment} onChange={timer.selectSegment} />

            <SessionTally
              total={timerSettings.sessionsBeforeLongBreak}
              completed={timer.cycle.completedFocusCount}
              currentIsFocus={timer.segment === 'focus'}
              iconSet={timerSettings.tallyIconSet}
            />

            {goalTarget > 0 ? (
              <GoalProgress completed={timer.goalProgress} target={goalTarget} />
            ) : null}
          </>
        ) : null}

        {timer.mode === 'pomodoro' && timer.goalReached ? (
          <GoalReachedPanel completed={timer.goalProgress} onContinue={timer.continueAfterGoal} />
        ) : (
          <>
            <div
              role="timer"
              aria-label={`${isStopwatch ? strings.focus.timeElapsed : strings.focus.timeRemaining} : ${displayLabel}`}
            >
              <TimerFace style={timerSettings.displayStyle} label={displayLabel} progress={progress} />
            </div>

            <TimerControls
              status={snapshot.status}
              onReset={timer.reset}
              onPrimary={handlePrimary}
              onSkip={timer.skip}
              showSkip={timer.mode === 'pomodoro'}
              onPictureInPicture={pip.toggle}
              pipAvailable={pip.isSupported}
            />
          </>
        )}
      </div>

      {pip.pipWindow
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
        : null}
    </div>
  )
}
