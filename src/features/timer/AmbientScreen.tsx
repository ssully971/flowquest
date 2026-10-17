import { Music, Pause, Play } from 'lucide-react'
import { useState } from 'react'

import { AmbientSoundsPanel } from '@/features/ambient/components/AmbientSoundsPanel'
import { useAmbientSounds } from '@/features/ambient/useAmbientSounds'
import { strings } from '@/shared/i18n'

import { formatCountdown } from './format'
import { useFocusTimer } from './useFocusTimer'

/** §5.3 : fond plein cadre (géré par AppShell), minuteur compact en carte en haut à
 * droite, le reste de l'écran libre — on réutilise le minuteur Focus existant. */
export function AmbientScreen() {
  const timer = useFocusTimer()
  const sounds = useAmbientSounds()
  const [isSoundsOpen, setIsSoundsOpen] = useState(false)

  if (!timer.isReady || !timer.snapshot) {
    return <div className="h-full" />
  }

  const { snapshot } = timer
  const displayLabel = formatCountdown(snapshot.remainingMs ?? 0)
  const isRunning = snapshot.status === 'running'
  const PrimaryIcon = isRunning ? Pause : Play
  const primaryLabel = isRunning
    ? strings.focus.controls.pause
    : snapshot.status === 'paused'
      ? strings.focus.controls.resume
      : strings.focus.controls.start

  const handlePrimary = () => {
    if (snapshot.status === 'running') timer.pause()
    else if (snapshot.status === 'paused') timer.resume()
    else timer.start()
  }

  return (
    <div className="relative h-full">
      <div className="absolute right-6 top-8 flex flex-col items-end gap-2 sm:right-14 sm:top-16">
        <div
          className="flex items-center gap-3 rounded-2xl border px-4 py-2.5"
          style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
        >
          <span
            className="text-lg font-semibold text-[var(--text)]"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {displayLabel}
          </span>
          <button
            type="button"
            aria-label={primaryLabel}
            onClick={handlePrimary}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--on-accent)] transition-transform duration-200 hover:scale-105"
          >
            <PrimaryIcon
              size={16}
              strokeWidth={1.75}
              aria-hidden="true"
              fill={isRunning ? 'none' : 'currentColor'}
            />
          </button>
        </div>

        <div className="relative">
          <button
            type="button"
            aria-label={strings.ambient.soundsButton}
            aria-expanded={isSoundsOpen}
            onClick={() => setIsSoundsOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            style={{
              borderColor: 'var(--line)',
              background: sounds.activeIds.length > 0 ? 'var(--accent)' : 'var(--surface)',
              color: sounds.activeIds.length > 0 ? 'var(--on-accent)' : 'var(--text)',
            }}
          >
            <Music size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <AmbientSoundsPanel
            open={isSoundsOpen}
            onClose={() => setIsSoundsOpen(false)}
            {...sounds}
          />
        </div>
      </div>
    </div>
  )
}
