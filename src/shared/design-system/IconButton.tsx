import type { LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'

import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import type { IconSize } from '@/features/settings/extras-settings'

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  label: string
}

// LOT H2, §2 : « Petite » (par défaut) rend les icônes de l'interface plus petites et les
// traits plus fins qu'avant ce lot (48px/20px/1.75 devient la valeur « Moyenne », pour
// qui préfère l'apparence précédente).
const BUTTON_SIZE_CLASSES: Record<IconSize, string> = {
  small: 'h-10 w-10',
  medium: 'h-12 w-12',
  large: 'h-14 w-14',
}
const ICON_SIZE_PX: Record<IconSize, number> = {
  small: 16,
  medium: 20,
  large: 24,
}
const ICON_STROKE_WIDTH: Record<IconSize, number> = {
  small: 1.5,
  medium: 1.75,
  large: 1.75,
}

export function IconButton({ icon: Icon, label, className = '', ...props }: IconButtonProps) {
  // `useExtrasSettings` lève si appelé hors ExtrasSettingsProvider (toujours monté en
  // pratique, au-dessus de tout écran qui affiche des boutons) — pas de repli silencieux
  // qui masquerait un montage isolé oublié dans un test.
  const { settings } = useExtrasSettings()
  const size = settings.iconSize

  return (
    // LOT H2, §4 : groupe nommé pour l'infobulle ci-dessous — un seul bouton par groupe,
    // jamais de `group` ambigu avec un parent qui en définirait un autre.
    <span className="group/icon-btn relative inline-flex">
      <button
        type="button"
        aria-label={label}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40 ${BUTTON_SIZE_CLASSES[size]} ${className}`}
        {...props}
      >
        <Icon size={ICON_SIZE_PX[size]} strokeWidth={ICON_STROKE_WIDTH[size]} aria-hidden="true" />
      </button>
      {/* Infobulle avec le nom de l'icône (LOT H2, §4) : souris uniquement (`hover:`
          compile en `@media (hover: hover)` avec Tailwind v4 — jamais de survol « collé »
          sur tactile), après 400 ms (`delay-[400ms]`), jamais pendant que le bouton est
          désactivé. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--text)] px-2 py-1 text-xs font-medium text-[var(--surface)] opacity-0 transition-opacity delay-[400ms] duration-150 group-hover/icon-btn:opacity-100 group-has-[:disabled]/icon-btn:opacity-0"
      >
        {label}
      </span>
    </span>
  )
}
