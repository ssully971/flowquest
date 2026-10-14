import type { FormEvent } from 'react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'
import { isValidPassword, isValidUsername } from '../validation'
import { FormField } from './FormField'
import { GoogleButton } from './GoogleButton'

interface SignUpFormProps {
  onSwitchToSignIn: () => void
}

export function SignUpForm({ onSwitchToSignIn }: SignUpFormProps) {
  const { signUpWithEmail, signInWithGoogle } = useAuth()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!isValidUsername(username)) {
      setFormError(strings.auth.errors.invalidUsername)
      return
    }
    if (!isValidPassword(password)) {
      setFormError(strings.auth.errors.invalidPassword)
      return
    }

    setIsSubmitting(true)
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(email, password, username)
      if (needsEmailConfirmation) setConfirmationSent(true)
    } catch {
      // déjà notifié par le toast
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmationSent) {
    return (
      <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-5">
        <p className="text-sm text-[var(--panel-text)]">{strings.auth.signUp.confirmationSent}</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-w-sm flex-col gap-4"
      noValidate
    >
      <FormField
        label={strings.auth.fields.username}
        value={username}
        onChange={setUsername}
        autoComplete="username"
      />
      <FormField
        label={strings.auth.fields.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <FormField
        label={strings.auth.fields.password}
        type="password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        hint={strings.auth.fields.passwordHint}
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
        {isSubmitting ? strings.auth.signUp.submitting : strings.auth.signUp.submit}
      </button>
      <div className="flex items-center gap-3 text-xs text-[var(--panel-muted)]">
        <span className="h-px flex-1 bg-[var(--panel-line)]" />
        {strings.auth.signIn.orContinueWith}
        <span className="h-px flex-1 bg-[var(--panel-line)]" />
      </div>
      <GoogleButton onClick={() => void signInWithGoogle()} label={strings.auth.signUp.google} />
      <button
        type="button"
        onClick={onSwitchToSignIn}
        className="text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
      >
        {strings.auth.signUp.switchToSignIn}
      </button>
    </form>
  )
}
