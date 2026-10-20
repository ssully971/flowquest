import { Switch } from './Switch'

interface SettingsToggleRowProps {
  label: string
  hint?: string
  checked: boolean
  onToggle: () => void
}

/** Carte réglage avec libellé, interrupteur, et indice optionnel — utilisée dans tous les
 * onglets de Réglages qui exposent des interrupteurs (Horloge, Minuteur, Citations, Extras).
 * Toute la ligne est la cible tactile (LOT D, zone ≥44px) — pas seulement le petit
 * interrupteur visuel (28px de haut) : un seul élément interactif par ligne (le bouton),
 * le <Switch> intérieur n'est que décoratif (`interactive={false}`), jamais de bouton
 * imbriqué dans un bouton. */
export function SettingsToggleRow({ label, hint, checked, onToggle }: SettingsToggleRowProps) {
  if (!hint) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className="flex max-w-md items-center justify-between gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4 text-left"
      >
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <Switch checked={checked} onChange={onToggle} label={label} interactive={false} />
      </button>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex max-w-md flex-col gap-1 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--panel-text)]">{label}</span>
        <Switch checked={checked} onChange={onToggle} label={label} interactive={false} />
      </div>
      <p className="text-xs text-[var(--panel-muted)]">{hint}</p>
    </button>
  )
}
