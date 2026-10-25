import { Users } from 'lucide-react'

import { useAuthGateRequest } from '../useAuthGateRequest'

interface SignInPromptProps {
  message: string
  ctaLabel: string
}

/**
 * État clair affiché à la place d'un écran social vide quand on n'est pas connecté
 * (LOT H1, §3 — avant, ces écrans n'affichaient rien du tout). Le bouton rouvre l'écran
 * de connexion existant (AuthGate) via useAuthGateRequest, même s'il a déjà été
 * fermé (« continuer en invité ») plus tôt dans la session.
 */
export function SignInPrompt({ message, ctaLabel }: SignInPromptProps) {
  const { requestSignIn } = useAuthGateRequest()

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <Users size={28} strokeWidth={1.5} className="text-[var(--muted)]" aria-hidden="true" />
      <p className="max-w-sm text-sm text-[var(--muted)]">{message}</p>
      <button
        type="button"
        onClick={requestSignIn}
        className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 hover:opacity-90"
      >
        {ctaLabel}
      </button>
    </div>
  )
}
