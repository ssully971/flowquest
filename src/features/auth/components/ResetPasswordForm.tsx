import type { FormEvent } from 'react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'
import { isValidPassword } from '../validation'
import { FormField } from './FormField'

/** Affiché quand la session vient du lien de réinitialisation reçu par e-mail
 * (AuthProvider.isPasswordRecovery) : le seul choix possible est un nouveau mot de
 * passe, pas l'accès normal au compte. */
export function ResetPasswordForm() {
  const { updatePassword, clearPasswordRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const s = strings.auth.resetPassword

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!isValidPassword(password)) {
      setFormError(strings.auth.errors.invalidPassword)
      return
    }
    if (password !== confirmPassword) {
      setFormError(s.mismatch)
      return
    }

    setIsSubmitting(true)
    try {
      await updatePassword(password)
    } catch {
      // déjà notifié par le toast
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-w-sm flex-col gap-4"
      noValidate
    >
      <p
        className="text-[28px] font-semibold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.newPasswordTitle}
      </p>
      <FormField
        label={s.newPassword}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint={strings.auth.fields.passwordHint}
      />
      <FormField
        label={s.confirmPassword}
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
      />
      {formError ? (
        <p role="alert" className="text-sm text-[#E5484D]">
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-60"
      >
        {isSubmitting ? s.submittingNew : s.submitNew}
      </button>
      <button
        type="button"
        onClick={clearPasswordRecovery}
        className="text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
      >
        {s.backToSignIn}
      </button>
    </form>
  )
}
