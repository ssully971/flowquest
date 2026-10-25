import { createContext } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastInput {
  type: ToastType
  message: string
  /** Bouton d'action optionnel (ex. « Reprendre » — LOT G2, Deep Focus) : le clic
   * déclenche `onClick` puis referme le toast comme le ferait le bouton Fermer. */
  action?: { label: string; onClick: () => void }
}

export interface ToastContextValue {
  showToast: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
