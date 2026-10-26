import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { strings } from '@/shared/i18n'

import { isInviteCodeWellFormed, normalizeInviteCode } from '../invite-code'
import { consumeInviteCode } from '../invites-repository'

/**
 * Bêta fermée, comptes Google : un nouveau compte créé par OAuth est « en attente »
 * (profiles.invite_ok = false, posé par le serveur). Cet écran remplace l'app tant qu'aucun
 * code valide n'a été saisi ; l'activation est faite par consume_invite_code() côté SQL
 * (le serveur bloque aussi les fonctions sociales via is_banned()). Les comptes existants
 * et ceux créés par e-mail avec un code ont invite_ok = true : l'écran ne s'affiche jamais.
 */
export function InviteCodeGate({ children }: { children: ReactNode }) {
  const { status, profile, retryLoadProfile, signOut } = useAuth()
  const betaClosed = useFeatureFlag('beta_fermee')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const autoActivatedRef = useRef(false)
  const s = strings.invites.gate

  const pending = status === 'authenticated' && profile?.invite_ok === false

  // Bêta rouverte par l'admin : un compte resté en attente est activé par le serveur
  // sans code (consume_invite_code), une seule tentative automatique.
  useEffect(() => {
    if (!pending || betaClosed || autoActivatedRef.current) return
    autoActivatedRef.current = true
    void consumeInviteCode('')
      .then(() => retryLoadProfile())
      .catch(() => {
        // Échec réseau : l'écran de saisie reste disponible.
        autoActivatedRef.current = false
      })
  }, [pending, betaClosed, retryLoadProfile])

  if (!pending) return <>{children}</>

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    const normalized = normalizeInviteCode(code)
    if (!isInviteCodeWellFormed(normalized)) {
      setError(s.invalid)
      return
    }
    setSubmitting(true)
    try {
      const ok = await consumeInviteCode(normalized)
      if (ok) {
        retryLoadProfile()
      } else {
        setError(s.invalid)
      }
    } catch (caught) {
      const tooMany = caught instanceof Error && caught.message === 'too_many_attempts'
      setError(tooMany ? s.tooManyAttempts : s.invalid)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[var(--bg)] p-6 text-center text-[var(--text)]">
      <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        {s.title}
      </h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">{s.body}</p>
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex w-full max-w-xs flex-col gap-3"
        noValidate
      >
        <input
          aria-label={strings.invites.signUp.label}
          value={code}
          onChange={(event) => setCode(normalizeInviteCode(event.target.value))}
          autoComplete="off"
          autoCapitalize="characters"
          className="h-12 rounded-xl border border-[var(--line)] bg-transparent px-3 text-center text-lg tracking-[0.3em] outline-none focus:border-[var(--accent)]"
        />
        {error ? (
          <p role="alert" className="text-sm text-[#E5484D]">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] disabled:opacity-60"
        >
          {submitting ? s.submitting : s.submit}
        </button>
      </form>
      <p className="max-w-sm text-xs text-[var(--muted)]">{s.pendingNote}</p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
      >
        {s.signOut}
      </button>
    </div>
  )
}
