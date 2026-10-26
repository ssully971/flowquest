import { Component } from 'react'
import type { ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** Repli affiché à la place du contenu planté — discret par défaut (rien), jamais un
   * message alarmant pour une fonctionnalité secondaire qui a simplement une erreur. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Frontière d'erreur générique (lot I2, §1 : chaque FeatureGate enveloppe aussi son
 * contenu dans une frontière d'erreur, pour qu'une fonctionnalité qui plante n'emporte
 * jamais le reste de l'écran avec elle). Doit être une classe : React n'offre pas
 * d'équivalent à base de hook pour `componentDidCatch`/`getDerivedStateFromError`.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    // Repli discret côté interface, mais l'erreur reste visible en console pour le
    // diagnostic (jamais de service de rapport tiers).
    console.error('[ErrorBoundary]', error)
  }

  render(): ReactNode {
    if (this.state.hasError) return this.props.fallback ?? null
    return this.props.children
  }
}
