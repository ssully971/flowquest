import type { LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: LucideIcon
}

// Pas de lecture de useExtrasSettings() ici à dessein : ce composant partagé
// (shared/design-system) sert aussi des usages sans icône (Apparence, Pomodoro/Compte à
// rebours...) dont les tests n'ont aucune raison de monter ExtrasSettingsProvider.
// L'appelant qui veut suivre le réglage « Taille des icônes » (AppShell, sélecteur de
// mode) passe `iconSize` explicitement.
export type SegmentedIconSize = 'small' | 'medium' | 'large'

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  /** Taille des icônes des options qui en ont une (par défaut « medium », apparence
   * d'avant le réglage « Taille des icônes »). Sans effet sur les options sans icône. */
  iconSize?: SegmentedIconSize
  /** « glass » (lot I1, §2) : verre dépoli sans aplat de couleur, pour un sélecteur qui
   * flotte directement sur le fond d'écran (sélecteur de mode Accueil/Focus/Ambiant,
   * Pomodoro/Compte à rebours/Chronomètre) — jamais à l'intérieur d'un panneau de
   * Réglages déjà opaque, qui garde « solid » (par défaut, inchangé). */
  variant?: 'solid' | 'glass'
}

interface IndicatorRect {
  left: number
  width: number
}

// Même échelle que IconButton (réglage « Taille des icônes », synchronisé par compte).
const ICON_SIZE_PX: Record<SegmentedIconSize, number> = {
  small: 15,
  medium: 18,
  large: 22,
}
const ICON_STROKE_WIDTH: Record<SegmentedIconSize, number> = {
  small: 1.5,
  medium: 1.75,
  large: 1.75,
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  iconSize = 'medium',
  variant = 'solid',
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map())
  const [indicator, setIndicator] = useState<IndicatorRect | null>(null)

  // Indicateur unique qui glisse vers le segment choisi (LOT D), plutôt qu'un fond
  // basculé indépendamment sur chaque bouton : mesure la position réelle du bouton
  // sélectionné (les segments n'ont pas tous la même largeur) et la reproduit sur un
  // calque commun, animé en CSS. jsdom ne mesure jamais de vraie mise en page
  // (getBoundingClientRect y renvoie des zéros) : seul un navigateur réel peut confirmer
  // visuellement le glissement, voir SegmentedControl.test.tsx.
  useLayoutEffect(() => {
    const container = containerRef.current
    const button = buttonRefs.current.get(value)
    if (!container || !button) return
    const containerRect = container.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    setIndicator({ left: buttonRect.left - containerRect.left, width: buttonRect.width })
  }, [value, options, iconSize])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const currentIndex = options.findIndex((option) => option.value === value)
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (currentIndex + 1) % options.length
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (currentIndex - 1 + options.length) % options.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = options.length - 1
    }
    if (nextIndex === null) return

    event.preventDefault()
    onChange(options[nextIndex].value)
    containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus()
  }

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={
        variant === 'glass'
          ? 'glass-pill relative inline-flex items-center gap-1 rounded-full p-1.5'
          : 'relative inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1.5'
      }
    >
      {indicator ? (
        <div
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 rounded-full bg-[var(--accent)] transition-[left,width] duration-200 ease-out"
          style={{ left: indicator.left, width: indicator.width }}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value
        const Icon = option.icon
        // Verre dépoli (lot I1, §2) : une option inactive reste neutre, gris clair/foncé
        // selon le thème (--glass-icon), jamais la teinte violette de --muted — seule
        // l'option sélectionnée porte --on-accent, posée sur la pastille --accent.
        const inactiveColorClass =
          variant === 'glass'
            ? 'text-[var(--glass-icon)] hover:text-[var(--glass-icon-hover)]'
            : 'text-[var(--muted)] hover:text-[var(--text)]'
        return (
          <button
            key={option.value}
            ref={(el) => {
              if (el) buttonRefs.current.set(option.value, el)
              else buttonRefs.current.delete(option.value)
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={Icon ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={handleKeyDown}
            className={
              Icon
                ? // Une option à icône (ex. le sélecteur de mode, demandé « en bas à
                  // droite ») : icône seule, le nom n'apparaît en dessous que pour l'option
                  // active — « c'est quand on appuie sur l'icône qu'en dessous ça montre
                  // le nom ». La pastille glissante ci-dessus reste le seul repère visuel
                  // des options inactives.
                  `relative z-10 flex h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-full px-2.5 transition-colors duration-150 ${
                    selected ? 'text-[var(--on-accent)]' : inactiveColorClass
                  }`
                : `relative z-10 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 ${
                    selected ? 'text-[var(--on-accent)]' : inactiveColorClass
                  }`
            }
          >
            {Icon ? (
              <Icon
                size={ICON_SIZE_PX[iconSize]}
                strokeWidth={ICON_STROKE_WIDTH[iconSize]}
                aria-hidden="true"
              />
            ) : null}
            {Icon ? (
              selected ? (
                <span className="text-[10px] font-medium leading-none">{option.label}</span>
              ) : null
            ) : (
              <span>{option.label}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
