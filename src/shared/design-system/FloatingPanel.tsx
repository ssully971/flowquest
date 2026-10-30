import { X } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'

import { GlassCard } from './GlassCard'
import { ModalOverlay } from './ModalOverlay'
import type { PanelDisplayMode } from './panel-display-mode'

interface FloatingPanelProps {
  panelRef: RefObject<HTMLDivElement | null>
  mode: PanelDisplayMode
  title: string
  closeLabel: string
  onClose: () => void
  /** Classes de taille propres à cet élément (Tâches vs Notes ont des dimensions
   * différentes), séparées du chrome commun pour rester spécifiques à chaque mode. */
  panelSizeClassName: string
  windowSizeClassName: string
  children: ReactNode
}

/**
 * Chrome partagé des panneaux flottants (Tâches, Notes — LOT B11) : « Petit panneau »
 * garde le popover ancré existant, « Grande fenêtre » les affiche en fenêtre centrée sur
 * fond flouté, à la façon de docs/reference/fenetre-taches.jpeg (inspiration ergonomique
 * uniquement). Utilise GlassCard (LOT C1) pour le style « Liquid Glass ».
 */
export function FloatingPanel({
  panelRef,
  mode,
  title,
  closeLabel,
  onClose,
  panelSizeClassName,
  windowSizeClassName,
  children,
}: FloatingPanelProps) {
  const header = (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold text-[var(--text)]">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={closeLabel}
        className="-m-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
      >
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )

  if (mode === 'window') {
    return (
      <ModalOverlay className="z-40" blur onBackdropClick={onClose}>
        <GlassCard
          ref={panelRef}
          role="dialog"
          aria-label={title}
          className={`relative z-10 flex flex-col gap-4 rounded-[28px] p-6 ${windowSizeClassName}`}
        >
          {header}
          {children}
        </GlassCard>
      </ModalOverlay>
    )
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={title}
      className={`absolute bottom-full right-0 z-40 mb-3 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_24px_var(--glow)] ${panelSizeClassName}`}
    >
      {header}
      {children}
    </div>
  )
}
