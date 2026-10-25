import { Menu as MenuIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { IconButton } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

export interface MobileMenuItem {
  key: string
  icon: LucideIcon
  label: string
  onClick: () => void
}

interface MobileMenuProps {
  items: MobileMenuItem[]
}

/**
 * Menu unique pour les actions secondaires de la barre du bas sur mobile (retour après
 * feu vert sur LOT H2, §5) : Réglages/Plein écran/Tâches/Notes/Série tenaient sur deux
 * lignes et surchargeaient l'accueil comme l'écran Focus — regroupés ici derrière un seul
 * bouton. Le sélecteur de mode (Accueil/Focus/Ambiant) reste hors de ce menu, toujours
 * visible directement dans la barre : c'est la navigation principale, pas une action
 * secondaire. Desktop inchangé : ces boutons restent directement dans la barre, ce menu
 * reste masqué à partir de `sm:` (voir AppShell).
 */
export function MobileMenu({ items }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative sm:hidden">
      <IconButton
        icon={MenuIcon}
        label={strings.common.menu}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      />
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label={strings.common.menu}
          className="absolute bottom-full left-0 z-40 mb-3 flex w-56 flex-col gap-1 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2 shadow-[0_10px_24px_var(--glow)]"
        >
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onClick()
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-2)]"
              >
                <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
