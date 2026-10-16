import { createPortal } from 'react-dom'

import { useQuotesSettings } from '@/features/home/quotes-settings-context'
import { useQuote } from '@/features/home/useQuote'
import { useActiveTask } from '@/features/tasks/active-task-context'
import { useTasks } from '@/features/tasks/useTasks'
import { useCurrentTime } from '@/shared/hooks/useCurrentTime'
import { strings } from '@/shared/i18n'

import { CycleDots } from './components/CycleDots'
import { SegmentTabs } from './components/SegmentTabs'
import { TimerControls } from './components/TimerControls'
import { TimerDisplay } from './components/TimerDisplay'
import { TimerPath } from './components/TimerPath'
import { getDurationForSegment } from './durations'
import { formatCountdown } from './format'
import { toDurationsMs } from './timer-settings'
import { useTimerSettings } from './timer-settings-context'
import { useFocusTimer } from './useFocusTimer'
import { usePictureInPicture } from './usePictureInPicture'

export function FocusScreen() {
  const timer = useFocusTimer()
  const pip = usePictureInPicture()
  const { activeTaskId } = useActiveTask()
  const { tasks } = useTasks()
  const { settings: timerSettings } = useTimerSettings()
  const { settings: quotesSettings } = useQuotesSettings()
  const now = useCurrentTime(60_000)
  const quote = useQuote(now)
  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null

  if (!timer.isReady || !timer.snapshot) {
    return <div className="h-full" />
  }

  const { snapshot } = timer
  const durationMs = getDurationForSegment(timer.segment, toDurationsMs(timerSettings))
  const progress = durationMs > 0 ? Math.min(1, snapshot.elapsedMs / durationMs) : 0
  const displayLabel = formatCountdown(snapshot.remainingMs ?? 0)

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

        <SegmentTabs value={timer.segment} onChange={timer.selectSegment} />

        <CycleDots
          total={timerSettings.sessionsBeforeLongBreak}
          completed={timer.cycle.completedFocusCount}
          currentIsFocus={timer.segment === 'focus'}
        />

        <div className="flex w-full flex-col items-center gap-5">
          <TimerDisplay label={displayLabel} />
          <TimerPath progress={progress} />
        </div>

        <TimerControls
          status={snapshot.status}
          onReset={timer.reset}
          onPrimary={handlePrimary}
          onSkip={timer.skip}
          onPictureInPicture={pip.toggle}
          pipAvailable={pip.isSupported}
        />
      </div>

      {pip.pipWindow
        ? createPortal(
            <div
              style={{
                fontFamily: 'sans-serif',
                background: '#120c1e',
                color: '#f2ecfc',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <div style={{ fontSize: 14, opacity: 0.7 }}>
                {timer.segment === 'focus'
                  ? strings.focus.tabs.focus
                  : timer.segment === 'short_break'
                    ? strings.focus.tabs.shortBreak
                    : strings.focus.tabs.longBreak}
              </div>
              <div style={{ fontSize: 40, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                {displayLabel}
              </div>
            </div>,
            pip.pipWindow.document.body,
          )
        : null}
    </div>
  )
}
