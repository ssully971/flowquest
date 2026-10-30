import { Info } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface UpsellModalProps {
  onClose: () => void
  onSignUp: () => void
  onSignIn: () => void
}

const FOCUSABLE =
  'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Modale d'upsell du mode invité : invite à créer un compte. Au-dessus de tous les
 * panneaux (z-[75]). Échap et clic sur le fond la ferment, le focus reste piégé dedans,
 * l'arrière-plan ne défile pas. La mention de bêta fermée suit le drapeau `beta_fermee`.
 */
export function UpsellModal({ onClose, onSignUp, onSignIn }: UpsellModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const primaryRef = useRef<HTMLButtonElement>(null)
  const betaClosed = useFeatureFlag('beta_fermee')
  const { status } = useAuth()
  const s = strings.access.upsell

  useEffect(() => {
    primaryRef.current?.focus()
  }, [])

  // Connexion réussie en arrière-plan : la modale se ferme.
  useEffect(() => {
    if (status === 'authenticated') onClose()
  }, [status, onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  // Phase de capture sur window : passe avant les écouteurs des panneaux ouverts dessous
  // (Réglages ferme sur Échap, piège aussi Tab), qui ne doivent pas réagir.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      event.stopPropagation()
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (!dialogRef.current?.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4">
      <div
        data-testid="upsell-backdrop"
        className="absolute inset-0"
        style={{ background: 'var(--scrim)' }}
        onClick={onClose}
      />
      <GlassCard
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upsell-title"
        className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col gap-5 overflow-y-auto rounded-3xl p-7"
      >
        <div className="flex flex-col gap-2 text-center">
          <h2
            id="upsell-title"
            className="font-brand text-balance text-xl"
            style={{ color: 'var(--text)' }}
          >
            {s.title}
          </h2>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {s.body}
          </p>
        </div>

        {betaClosed ? (
          <p
            className="flex items-start gap-2 rounded-xl border px-3 py-2 text-left text-xs"
            style={{ borderColor: 'var(--line)', color: 'var(--text)' }}
          >
            <Info size={14} strokeWidth={2} aria-hidden="true" className="mt-px shrink-0" />
            {s.betaNotice}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <button
            ref={primaryRef}
            type="button"
            onClick={onSignUp}
            className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 hover:opacity-90"
          >
            {s.signUp}
          </button>
          <button
            type="button"
            onClick={onSignIn}
            className="h-11 rounded-xl border border-[var(--line)] text-sm font-semibold text-[var(--text)] transition-colors duration-200 hover:bg-[var(--line)]"
          >
            {s.signIn}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-center text-xs text-[var(--muted)] underline-offset-2 hover:underline"
          >
            {s.later}
          </button>
        </div>
      </GlassCard>
    </div>
  )
}
