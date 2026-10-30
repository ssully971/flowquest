import {
  Loader2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from 'lucide-react'

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
  /** Masque « Réinitialiser » (session de groupe : l'horloge est celle du salon). */
  showReset?: boolean
  /** Action en cours (session de groupe) : tous les boutons sont désactivés et le bouton
   * principal affiche un indicateur de chargement avec ce libellé (« Lancement… »). */
  busyLabel?: string | null
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
  showReset = true,
  busyLabel = null,
}: TimerControlsProps) {
  const busy = busyLabel !== null
  const isRunning = status === 'running'
  const isIdle = status === 'idle'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning
    ? strings.focus.controls.pause
    : status === 'paused'
      ? strings.focus.controls.resume
      : strings.focus.controls.start
  // LOT H2, §5 : sur mobile, tant que rien n'a démarré, seuls Réinitialiser et Lancer
  // sont utiles (passer/terminer/PIP n'ont de sens qu'une fois une session en cours) —
  // masqué en CSS via un wrapper dédié (`hidden sm:block`, jamais de classe conflictuelle
  // posée directement sur IconButton, qui porte déjà son propre `inline-flex`).
  const idleMobileOnlyClassName = isIdle ? 'hidden sm:block' : undefined

  return (
    <div className="flex items-center gap-4">
      {showReset ? (
        <IconButton
          icon={RotateCcw}
          label={strings.focus.controls.reset}
          onClick={onReset}
          disabled={busy}
        />
      ) : null}
      <button
        type="button"
        aria-label={busy ? busyLabel : primaryLabel}
        aria-busy={busy}
        disabled={busy}
        onClick={onPrimary}
        className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105 disabled:cursor-wait disabled:opacity-70 disabled:hover:scale-100"
      >
        {busy ? (
          <Loader2 size={26} strokeWidth={1.75} aria-hidden="true" className="animate-spin" />
        ) : (
          <PrimaryIcon
            size={26}
            strokeWidth={1.75}
            aria-hidden="true"
            fill={isRunning ? 'none' : 'currentColor'}
          />
        )}
      </button>
      {showSkip ? (
        <span className={idleMobileOnlyClassName}>
          <IconButton
            icon={SkipForward}
            label={strings.focus.controls.skip}
            onClick={onSkip}
            disabled={busy}
          />
        </span>
      ) : null}
      {showEndSession && onEndSession ? (
        <span className={idleMobileOnlyClassName}>
          <IconButton
            icon={Square}
            label={strings.focus.controls.endSession}
            onClick={onEndSession}
            disabled={busy}
          />
        </span>
      ) : null}
      {showPip ? (
        <span className={idleMobileOnlyClassName}>
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
        </span>
      ) : null}
    </div>
  )
}
