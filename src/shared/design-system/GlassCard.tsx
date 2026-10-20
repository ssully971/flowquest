import { forwardRef } from 'react'
import type { ComponentPropsWithoutRef } from 'react'

/**
 * Composant partagé « Liquid Glass » (LOT C1) : formalise la classe .glass-panel
 * (src/styles/global.css, posée au LOT A7 — fond translucide + flou, repli opaque sans
 * backdrop-filter, repli sans flou en prefers-reduced-transparency) en un composant React
 * réutilisable plutôt qu'une classe copiée à chaque usage. Utilisé par AuthGate,
 * FloatingPanel (mode « grande fenêtre ») et la carte horloge du mode Ambiant.
 */
export const GlassCard = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<'div'>>(
  function GlassCard({ className = '', ...props }, ref) {
    return <div ref={ref} className={`glass-panel ${className}`.trim()} {...props} />
  },
)
