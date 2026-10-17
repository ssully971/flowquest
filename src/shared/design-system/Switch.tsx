interface SwitchProps {
  checked: boolean
  onChange: () => void
  label: string
}

/**
 * Piste de 48px (w-12), curseur de 20px (h-5 w-5) : décalage horizontal de 4px (désactivé)
 * à 24px (activé), donc un curseur toujours compris entre 4px et 24px+20px=44px — avec 4px
 * de marge de chaque côté de la piste de 48px, jamais de dépassement.
 */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-[var(--accent)]' : 'bg-[var(--panel-line)]'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
