import { createContext } from 'react'

export type ToastType = 'info' | 'success' | 'error'

export interface ToastInput {
  type: ToastType
  message: string
}

export interface ToastContextValue {
  showToast: (toast: ToastInput) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
