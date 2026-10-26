import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { GlassCard } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { useAuthGateRequest } from './useAuthGateRequest'
import { ForgotPasswordForm } from './components/ForgotPasswordForm'
import { SignInForm } from './components/SignInForm'
import { SignUpForm } from './components/SignUpForm'
import { useAuth } from './useAuth'

// Identifiant technique historique : ne pas renommer sans migration des données (voir docs/RENOMMAGE.md).
const DISMISSED_KEY = 'flowquest.authGateDismissed'

type GateView = 'choice' | 'signIn' | 'signUp' | 'forgotPassword'

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === 'true'
  } catch {
    return false
  }
}

interface AuthGateProps {
  children: ReactNode
}

/**
 * Fenêtre plein écran affichée au premier chargement non connecté (hors /admin et
 * /diagnostic, jamais montée sur ces routes — voir App.tsx). `children` reste toujours
 * monté derrière : fermer la fenêtre (choix invité) ne perd donc aucun état.
 *
 * Style translucide « Liquid Glass » (composant partagé GlassCard, LOT C1).
 */
export function AuthGate({ children }: AuthGateProps) {
  const { status, isSupabaseConfigured } = useAuth()
  const { signInRequested, clearSignInRequest } = useAuthGateRequest()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [view, setView] = useState<GateView>('choice')
  const [handledSignInRequest, setHandledSignInRequest] = useState(signInRequested)
  const s = strings.auth.gate

  // `signInRequested` (LOT H1, §3) rouvre la fenêtre directement sur le formulaire de
  // connexion même si elle a déjà été fermée (« continuer en invité ») plus tôt. Ajusté
  // pendant le rendu plutôt que dans un effet (pas de rendu supplémentaire en cascade) :
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  if (signInRequested !== handledSignInRequest) {
    setHandledSignInRequest(signInRequested)
    if (signInRequested) setView('signIn')
  }

  const shouldShow = isSupabaseConfigured && status === 'guest' && (!dismissed || signInRequested)

  useEffect(() => {
    if (status === 'authenticated' && signInRequested) clearSignInRequest()
  }, [status, signInRequested, clearSignInRequest])

  const handleContinueAsGuest = () => {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, 'true')
    } catch {
      // Stockage indisponible (navigation privée) : la fenêtre peut revenir au
      // prochain rendu, sans conséquence grave (toujours fermable à nouveau).
    }
    setDismissed(true)
    clearSignInRequest()
    setView('choice')
  }

  return (
    <>
      {children}
      {shouldShow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0" style={{ background: 'var(--scrim)' }} />
          <GlassCard
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-gate-title"
            className="relative flex w-full max-w-sm flex-col gap-5 rounded-3xl p-7"
          >
            {view !== 'choice' ? (
              <button
                type="button"
                onClick={() => setView(view === 'forgotPassword' ? 'signIn' : 'choice')}
                aria-label={s.back}
                className="flex w-fit items-center gap-1 text-xs text-[var(--panel-muted)] transition-colors duration-200 hover:text-[var(--panel-text)]"
              >
                <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
                {s.back}
              </button>
            ) : null}

            {view === 'choice' ? (
              <>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h2
                    id="auth-gate-title"
                    className="text-xl font-semibold"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}
                  >
                    {s.title}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>
                    {s.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('signIn')}
                  className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 hover:opacity-90"
                >
                  {s.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => setView('signUp')}
                  className="h-11 rounded-xl border border-[var(--line)] text-sm font-semibold text-[var(--text)] transition-colors duration-200 hover:bg-[var(--line)]"
                >
                  {s.signUp}
                </button>
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="text-center text-xs text-[var(--muted)] underline-offset-2 hover:underline"
                >
                  {s.continueAsGuest}
                </button>
              </>
            ) : view === 'signIn' ? (
              <SignInForm
                onSwitchToSignUp={() => setView('signUp')}
                onForgotPassword={() => setView('forgotPassword')}
              />
            ) : view === 'signUp' ? (
              <SignUpForm onSwitchToSignIn={() => setView('signIn')} />
            ) : (
              <ForgotPasswordForm onBack={() => setView('signIn')} />
            )}
          </GlassCard>
        </div>
      ) : null}
    </>
  )
}
