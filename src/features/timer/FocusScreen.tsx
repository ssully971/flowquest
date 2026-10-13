import { createPortal } from 'react-dom'

import { strings } from '@/shared/i18n'

import { CycleDots } from './components/CycleDots'
import { SegmentTabs } from './components/SegmentTabs'
import { TimerControls } from './components/TimerControls'
import { TimerDisplay } from './components/TimerDisplay'
import { TimerPath } from './components/TimerPath'
import { getDurationForSegment, POMODORO_DEFAULTS } from './durations'
import { formatCountdown } from './format'
import { useFocusTimer } from './useFocusTimer'
import { usePictureInPicture } from './usePictureInPicture'

export function FocusScreen() {
  const timer = useFocusTimer()
  const pip = usePictureInPicture()

  if (!timer.isReady || !timer.snapshot) {
    return <div className="h-full" />
  }

  const { snapshot } = timer
  const durationMs = getDurationForSegment(timer.segment)
  const progress = durationMs > 0 ? Math.min(1, snapshot.elapsedMs / durationMs) : 0
  const displayLabel = formatCountdown(snapshot.remainingMs ?? 0)

  const handlePrimary = () => {
    if (snapshot.status === 'running') timer.pause()
    else if (snapshot.status === 'paused') timer.resume()
    else timer.start()
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 px-4 text-center">
      <div>
        <p
          className="text-[28px] font-semibold text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {strings.focus.question}
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">{strings.focus.noActiveTask}</p>
      </div>

      <SegmentTabs value={timer.segment} onChange={timer.selectSegment} />

      <CycleDots
        total={POMODORO_DEFAULTS.sessionsBeforeLongBreak}
        completed={timer.cycle.completedFocusCount}
        currentIsFocus={timer.segment === 'focus'}
      />

      <div className="flex flex-col items-center gap-6">
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
