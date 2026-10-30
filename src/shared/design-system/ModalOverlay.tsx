import type { FocusEvent, ReactNode } from 'react'

interface ModalOverlayProps {
  /** La carte de la fenêtre (un seul enfant, avec sa largeur : `w-full max-w-sm`…). */
  children: ReactNode
  /** Classe de profondeur (`z-[70]`…). */
  className?: string
  /** Clic sur le fond (en dehors de la carte). */
  onBackdropClick?: () => void
  /** Flou du fond (fenêtres « Liquid Glass »). */
  blur?: boolean
  backdropTestId?: string
}

/**
 * Cadre commun des fenêtres modales : le conteneur DÉFILE (`overflow-y-auto`, hauteur du
 * viewport) au lieu d'être centré sans limite. La carte est centrée quand elle tient à
 * l'écran (marges verticales automatiques) et alignée en haut, défilable, quand elle est plus
 * haute que l'écran — petit téléphone, clavier ouvert, texte agrandi : le haut de la carte
 * (premier champ d'un formulaire) n'est plus jamais coupé. Marges de sécurité (encoche,
 * barre d'accueil) incluses. Un champ qui prend le focus est ramené dans la vue, une fois le
 * clavier ouvert.
 */
export function ModalOverlay({
  children,
  className = 'z-50',
  onBackdropClick,
  blur = false,
  backdropTestId,
}: ModalOverlayProps) {
  const handleFocus = (event: FocusEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
    // Laisse le clavier mobile finir de s'ouvrir avant de recentrer le champ actif.
    window.setTimeout(() => {
      if (document.activeElement === target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }, 300)
  }

  return (
    <div className={`fixed inset-0 overflow-y-auto overscroll-contain ${className}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background: 'var(--scrim)',
          ...(blur ? { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } : {}),
        }}
      />
      <div
        data-testid={backdropTestId}
        onFocusCapture={handleFocus}
        onClick={(event) => {
          if (event.target === event.currentTarget) onBackdropClick?.()
        }}
        className="relative flex min-h-full justify-center px-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] [&>*]:my-auto"
      >
        {children}
      </div>
    </div>
  )
}
