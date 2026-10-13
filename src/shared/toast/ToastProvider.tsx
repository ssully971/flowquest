import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { ToastContext } from './toast-context'
import type { ToastInput, ToastType } from './toast-context'

interface ToastItem extends ToastInput {
  id: number
}

const ICONS: Record<ToastType, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  error: AlertCircle,
}

const ACCENT_COLORS: Record<ToastType, string> = {
  info: 'var(--muted)',
  success: 'var(--accent)',
  error: '#E5484D',
}

const DURATION_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback(
    (toast: ToastInput) => {
      const id = idRef.current++
      setToasts((current) => [...current, { ...toast, id }])
      window.setTimeout(() => dismiss(id), DURATION_MS)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-28"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type]
          return (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-[0_10px_24px_var(--glow)]"
            >
              <Icon
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
                style={{ color: ACCENT_COLORS[toast.type], flexShrink: 0, marginTop: 2 }}
              />
              <p className="flex-1">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Fermer la notification"
                className="shrink-0 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
