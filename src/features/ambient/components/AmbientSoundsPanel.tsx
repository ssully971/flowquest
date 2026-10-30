import { useEffect, useRef } from 'react'

import { strings } from '@/shared/i18n'

import { AMBIENT_SOUNDS, SLEEP_TIMER_OPTIONS_MINUTES } from '../sounds'
import type { UseAmbientSoundsResult } from '../useAmbientSounds'

interface AmbientSoundsPanelProps extends UseAmbientSoundsResult {
  open: boolean
  onClose: () => void
  /** `end` : aligné sur le bord droit du bouton ; `center` : centré sous lui. */
  placement?: 'end' | 'center'
  direction?: 'down' | 'up'
}

export function AmbientSoundsPanel({
  open,
  onClose,
  activeIds,
  volumes,
  canActivateMore,
  toggle,
  setVolume,
  sleepTimerMinutes,
  setSleepTimerMinutes,
  remainingSleepMs,
  placement = 'end',
  direction = 'down',
}: AmbientSoundsPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const s = strings.ambient

  useEffect(() => {
    if (!open) return

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={s.soundsTitle}
      className={`absolute ${direction === 'up' ? 'bottom-full mb-3' : 'top-full mt-3'} z-40 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_24px_var(--glow)] ${
        placement === 'center' ? 'left-1/2 -translate-x-1/2' : 'right-0'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-[var(--text)]">{s.soundsTitle}</p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">{s.soundsHint}</p>
      </div>

      <div className="flex flex-col gap-3">
        {AMBIENT_SOUNDS.map((sound) => {
          const isActive = activeIds.includes(sound.id)
          const disabled = !isActive && !canActivateMore
          return (
            <div key={sound.id} className="flex flex-col gap-2">
              <button
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => toggle(sound.id)}
                className={`flex h-10 items-center justify-between rounded-full px-4 text-sm transition-colors duration-200 ${
                  isActive
                    ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                    : 'bg-[var(--surface-2)] text-[var(--text)]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {sound.label}
              </button>
              {isActive ? (
                <label className="flex items-center gap-2 px-1 text-xs text-[var(--muted)]">
                  {s.volume}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volumes[sound.id] ?? 0.6}
                    onChange={(event) => setVolume(sound.id, Number(event.target.value))}
                    aria-label={`${s.volume} — ${sound.label}`}
                    className="flex-1"
                  />
                </label>
              ) : null}
            </div>
          )
        })}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-[var(--muted)]">
          {s.sleepTimer}
          {remainingSleepMs !== null ? ` · ${Math.ceil(remainingSleepMs / 60_000)} min` : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={sleepTimerMinutes === null}
            onClick={() => setSleepTimerMinutes(null)}
            className={`h-8 rounded-full px-3 text-xs transition-colors duration-200 ${
              sleepTimerMinutes === null
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'bg-[var(--surface-2)] text-[var(--text)]'
            }`}
          >
            {s.sleepTimerNone}
          </button>
          {SLEEP_TIMER_OPTIONS_MINUTES.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={sleepTimerMinutes === minutes}
              onClick={() => setSleepTimerMinutes(minutes)}
              className={`h-8 rounded-full px-3 text-xs transition-colors duration-200 ${
                sleepTimerMinutes === minutes
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)]'
              }`}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
