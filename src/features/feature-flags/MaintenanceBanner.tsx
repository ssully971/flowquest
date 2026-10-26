import { X } from 'lucide-react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useMaintenanceBanner } from './useMaintenanceBanner'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const DISMISSED_KEY = 'flowquest.maintenanceBannerDismissed'

/**
 * Bandeau de maintenance (lot I2, §1) : discret, fermable pour la session en cours
 * (sessionStorage — réapparaît au prochain chargement complet, tant que le drapeau reste
 * actif). Affiché globalement (AppShell), au même niveau que CheersBanner.
 */
export function MaintenanceBanner() {
  const { enabled, message } = useMaintenanceBanner()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) === 'true'
    } catch {
      return false
    }
  })

  if (!enabled || dismissed || !message.trim()) return null
  const s = strings.common.maintenanceBanner

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // Stockage indisponible : le bandeau réapparaîtra au prochain rendu, tant pis.
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        role="status"
        className="glass-panel pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-2.5"
      >
        <p className="flex-1 text-sm text-[var(--text)]">
          <span className="font-medium">{s.label}</span> {message}
        </p>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={s.dismiss}
          className="-m-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <X size={15} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
