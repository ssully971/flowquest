import { useEffect, useRef } from 'react'

import { strings } from '@/shared/i18n'

import { MAX_NODE_SCALE, MIN_NODE_SCALE } from './constellation-settings'
import type { ConstellationSettings } from './constellation-settings'
import type { LabelMode } from './draw-constellation'

interface ConstellationSettingsPopoverProps {
  settings: ConstellationSettings
  onChange: (settings: ConstellationSettings) => void
  onReset: () => void
  onReorganize: () => void
  onClose: () => void
}

const LABEL_MODES: LabelMode[] = ['auto', 'always', 'never']

/** Popover de réglages d'affichage (288 px) : étiquettes, tâches à faire, flèches, archivées,
 * taille des nœuds. Fermé par Échap ou un clic à l'extérieur. */
export function ConstellationSettingsPopover({
  settings,
  onChange,
  onReset,
  onReorganize,
  onClose,
}: ConstellationSettingsPopoverProps) {
  const s = strings.constellation.settings
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      // Le bouton qui ouvre le popover gère lui-même la bascule.
      if (
        ref.current &&
        !ref.current.contains(target) &&
        !(target as Element).closest?.('[data-settings-toggle]')
      ) {
        onClose()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [onClose])

  const checkbox = (key: 'showTodo' | 'showArrows' | 'showArchived', label: string) => (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm text-[var(--text)]">
      {label}
      <input
        type="checkbox"
        checked={settings[key]}
        onChange={(event) => onChange({ ...settings, [key]: event.target.checked })}
        className="h-5 w-5 accent-[var(--accent)]"
      />
    </label>
  )

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={s.open}
      data-testid="constellation-settings"
      className="w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] p-4 shadow-xl backdrop-blur-md"
    >
      <p className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--cst-label)]">
        {s.display}
      </p>
      <p className="mb-1 text-sm text-[var(--text)]">{s.labels}</p>
      <div
        role="group"
        aria-label={s.labels}
        className="mb-1 grid grid-cols-3 gap-1 rounded-xl bg-[var(--cst-bg)] p-1"
      >
        {LABEL_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            aria-pressed={settings.labels === mode}
            onClick={() => onChange({ ...settings, labels: mode })}
            className={`min-h-11 rounded-lg text-sm transition-colors ${
              settings.labels === mode
                ? 'bg-[var(--cst-chrome-line)] text-[var(--text)]'
                : 'text-[var(--cst-label)] hover:text-[var(--text)]'
            }`}
          >
            {s.labelModes[mode]}
          </button>
        ))}
      </div>
      {checkbox('showTodo', s.showTodo)}
      {checkbox('showArrows', s.showArrows)}
      {checkbox('showArchived', s.showArchived)}
      <label className="block pt-1 text-sm text-[var(--text)]">
        <span className="flex items-center justify-between">
          {s.nodeSize}
          <span className="tabular-nums text-[var(--cst-label)]">
            {settings.nodeScale.toFixed(1).replace('.', ',')}×
          </span>
        </span>
        <input
          type="range"
          aria-label={s.nodeSize}
          min={MIN_NODE_SCALE}
          max={MAX_NODE_SCALE}
          step={0.1}
          value={settings.nodeScale}
          onChange={(event) => onChange({ ...settings, nodeScale: Number(event.target.value) })}
          className="mt-2 h-6 w-full accent-[var(--accent)]"
        />
      </label>
      <div className="mt-3 flex items-center justify-between border-t border-[var(--cst-chrome-line)] pt-3">
        <button
          type="button"
          onClick={onReset}
          className="min-h-11 px-2 text-sm text-[var(--cst-label)] hover:text-[var(--text)]"
        >
          {s.reset}
        </button>
        <button
          type="button"
          onClick={onReorganize}
          className="min-h-11 rounded-xl border border-[var(--cst-chrome-line)] px-3 text-sm text-[var(--text)]"
        >
          {s.reorganize}
        </button>
      </div>
    </div>
  )
}
