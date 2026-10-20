interface SwitchProps {
  checked: boolean
  onChange: () => void
  label: string
}

/**
 * Piste de 48px (w-12), curseur de 20px (h-5 w-5) : décalage horizontal de 4px (désactivé)
 * à 24px (activé), donc un curseur toujours compris entre 4px et 24px+20px=44px — avec 4px
 * de marge de chaque côté de la piste de 48px, jamais de dépassement.
 *
 * `left-0` sur la pastille est nécessaire, pas cosmétique : sans lui, sa position avant
 * translate (left/right tous deux "auto") est recalculée par Chromium en tenant compte du
 * `text-align: center` par défaut des <button>, ce qui décalait la pastille de +24px (la
 * moitié de la piste) en plus de translate-x-1/6 — confirmé par mesure de pixels réelle
 * (getBoundingClientRect) en navigateur : la pastille activée se retrouvait entièrement
 * hors de la piste. `left-0` fixe sa position de départ explicitement, supprimant cette
 * ambiguïté — jsdom ne peut pas détecter ce genre de bug (aucune mise en page réelle),
 * voir Switch.test.tsx.
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
        className={`absolute top-1 left-0 h-5 w-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}
