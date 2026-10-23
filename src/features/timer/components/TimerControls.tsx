import { Pause, PictureInPicture2, Play, RotateCcw, SkipForward, Square } from 'lucide-react'

import { IconButton } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import type { TimerStatus } from '../engine/timer-engine'

interface TimerControlsProps {
  status: TimerStatus
  onReset: () => void
  onPrimary: () => void
  onSkip: () => void
  showSkip?: boolean
  onEndSession?: () => void
  showEndSession?: boolean
  onPictureInPicture: () => void
  pipAvailable: boolean
  showPip?: boolean
}

export function TimerControls({
  status,
  onReset,
  onPrimary,
  onSkip,
  showSkip = true,
  onEndSession,
  showEndSession = false,
  onPictureInPicture,
  pipAvailable,
  showPip = true,
}: TimerControlsProps) {
  const isRunning = status === 'running'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning
    ? strings.focus.controls.pause
    : status === 'paused'
      ? strings.focus.controls.resume
      : strings.focus.controls.start

  return (
    <div className="flex items-center gap-4">
      <IconButton icon={RotateCcw} label={strings.focus.controls.reset} onClick={onReset} />
      <button
        type="button"
        aria-label={primaryLabel}
        onClick={onPrimary}
        className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105"
      >
        <PrimaryIcon
          size={26}
          strokeWidth={1.75}
          aria-hidden="true"
          fill={isRunning ? 'none' : 'currentColor'}
        />
      </button>
      {showSkip ? (
        <IconButton icon={SkipForward} label={strings.focus.controls.skip} onClick={onSkip} />
      ) : null}
      {showEndSession && onEndSession ? (
        <IconButton icon={Square} label={strings.focus.controls.endSession} onClick={onEndSession} />
      ) : null}
      {showPip ? (
        <IconButton
          icon={PictureInPicture2}
          label={
            pipAvailable
              ? strings.focus.controls.pictureInPicture
              : strings.focus.controls.pictureInPictureUnavailable
          }
          onClick={onPictureInPicture}
          disabled={!pipAvailable}
        />
      ) : null}
    </div>
  )
}
