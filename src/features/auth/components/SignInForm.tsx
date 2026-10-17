import type { FormEvent } from 'react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'
import { FormField } from './FormField'
import { GoogleSignInButton } from './GoogleSignInButton'

interface SignInFormProps {
  onSwitchToSignUp: () => void
  onForgotPassword: () => void
}

export function SignInForm({ onSwitchToSignUp, onForgotPassword }: SignInFormProps) {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await signInWithEmail(email, password)
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
        autoComplete="current-password"
      />
      <button
        type="button"
        onClick={onForgotPassword}
        className="-mt-2 text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
      >
        {strings.auth.signIn.forgotPassword}
      </button>
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-60"
      >
        {isSubmitting ? strings.auth.signIn.submitting : strings.auth.signIn.submit}
      </button>
      <div className="flex items-center gap-3 text-xs text-[var(--panel-muted)]">
        <span className="h-px flex-1 bg-[var(--panel-line)]" />
        {strings.auth.signIn.orContinueWith}
        <span className="h-px flex-1 bg-[var(--panel-line)]" />
      </div>
      <GoogleSignInButton label={strings.auth.signIn.google} />
      <button
        type="button"
        onClick={onSwitchToSignUp}
        className="text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
      >
        {strings.auth.signIn.switchToSignUp}
      </button>
    </form>
  )
}
