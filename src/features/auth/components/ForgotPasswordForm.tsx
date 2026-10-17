import type { FormEvent } from 'react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'
import { FormField } from './FormField'

interface ForgotPasswordFormProps {
  onBack: () => void
}

export function ForgotPasswordForm({ onBack }: ForgotPasswordFormProps) {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const s = strings.auth.resetPassword

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch {
      // déjà notifié par le toast
    } finally {
      setIsSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-5">
        <p className="text-sm text-[var(--panel-text)]">{s.requestSent}</p>
        <button
          type="button"
          onClick={onBack}
          className="text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
        >
          {s.backToSignIn}
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex max-w-sm flex-col gap-4"
      noValidate
    >
      <p className="text-sm text-[var(--panel-muted)]">{s.requestBody}</p>
      <FormField
        label={strings.auth.fields.email}
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-60"
      >
        {isSubmitting ? s.requestSubmitting : s.requestSubmit}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="text-left text-sm text-[var(--panel-muted)] underline-offset-2 hover:underline"
      >
        {s.backToSignIn}
      </button>
    </form>
  )
}
