import { Switch } from './Switch'

interface SettingsToggleRowProps {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}

/** Carte réglage avec libellé, interrupteur, et indice optionnel — utilisée dans tous les
 * onglets de Réglages qui exposent des interrupteurs (Horloge, Minuteur, Citations, Extras). */
export function SettingsToggleRow({ label, hint, checked, onToggle }: SettingsToggleRowProps) {
  if (!hint) {
    return (
      <div className="flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <Switch checked={checked} onChange={onToggle} label={label} />
      </div>
    )
  }

  return (
    <div className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <Switch checked={checked} onChange={onToggle} label={label} />
      </div>
      <p className="text-xs text-[var(--panel-muted)]">{hint}</p>
    </div>
  )
}
