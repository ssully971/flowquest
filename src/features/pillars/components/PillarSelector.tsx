import { useEffect, useRef, useState } from 'react'

import { strings } from '@/shared/i18n'

import { useActivePillar } from '../active-pillar-context'
import { usePillars } from '../usePillars'

interface PillarSelectorProps {
  /** Vrai pendant qu'une session tourne ou est en pause : changer de pilier en cours de
   * session fausserait le temps crédité (recordSession attache le pilier actif au
   * moment où la session se termine, pas à son lancement). */
  disabled?: boolean
}

/**
 * Pastille colorée discrète à côté du titre de la session (LOT G3) — jamais un nouveau
 * bouton permanent sur l'accueil : n'apparaît que sur l'écran Focus, à côté du titre
 * déjà présent. Le dernier pilier utilisé reste présélectionné (ActivePillarProvider,
 * persisté en localStorage) ; tant qu'aucun choix explicite n'a été fait, le premier
 * pilier actif (souvent « Général ») est pris par défaut.
 */
export function PillarSelector({ disabled = false }: PillarSelectorProps) {
  const { activePillars, isLoading } = usePillars()
  const { activePillarId, setActivePillarId } = useActivePillar()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected =
    activePillars.find((pillar) => pillar.id === activePillarId) ?? activePillars[0] ?? null

  useEffect(() => {
    if (isLoading || activePillars.length === 0) return
    if (activePillarId && activePillars.some((pillar) => pillar.id === activePillarId)) return
    setActivePillarId(activePillars[0].id)
  }, [isLoading, activePillarId, activePillars, setActivePillarId])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (isLoading || !selected) return null

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`${strings.pillars.selectorLabel} : ${selected.name}`}
        aria-expanded={isOpen}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-1 ring-[var(--line)] transition-transform duration-150 hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
        style={{ backgroundColor: selected.color }}
      />

      {isOpen ? (
        <div
          role="menu"
          aria-label={strings.pillars.choosePillar}
          className="absolute left-1/2 top-full z-10 mt-2 w-44 -translate-x-1/2 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1 text-left shadow-lg"
        >
          {activePillars.map((pillar) => (
            <button
              key={pillar.id}
              type="button"
              role="menuitemradio"
              aria-checked={pillar.id === selected.id}
              onClick={() => {
                setActivePillarId(pillar.id)
                setIsOpen(false)
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface-2)]"
            >
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: pillar.color }}
                aria-hidden="true"
              />
              <span className="flex-1 truncate">{pillar.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
