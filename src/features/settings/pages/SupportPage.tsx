import type { FormEvent } from 'react'
import { useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { sendSupportMessage } from '@/features/settings/support/send-support-message'
import { APP_VERSION } from '@/shared/app-version'
import { strings } from '@/shared/i18n'

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function SupportPage() {
  const s = strings.settings.support
  const { user, isSupabaseConfigured } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [body, setBody] = useState('')
  const [state, setState] = useState<SubmitState>('idle')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    void sendSupportMessage(email, body, user?.id ?? null).then((result) => {
      if (result.ok) {
        setState('success')
        setBody('')
      } else {
        setState('error')
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div className="max-w-md">
        <h3 className="mb-3 text-sm font-medium text-[var(--panel-muted)]">{s.formTitle}</h3>

        {!isSupabaseConfigured ? (
          <p className="text-sm text-[var(--panel-muted)]">{s.notConfigured}</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label
                htmlFor="support-email"
                className="mb-1 block text-xs text-[var(--panel-muted)]"
              >
                {s.emailLabel}
              </label>
              <input
                id="support-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={s.emailPlaceholder}
                className="h-11 w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
              />
            </div>

            <div>
              <label
                htmlFor="support-body"
                className="mb-1 block text-xs text-[var(--panel-muted)]"
              >
                {s.bodyLabel}
              </label>
              <textarea
                id="support-body"
                required
                maxLength={2000}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={s.bodyPlaceholder}
                rows={5}
                className="w-full resize-none rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-4 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
              />
            </div>

            <button
              type="submit"
              disabled={state === 'submitting'}
              className="h-11 w-fit rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-50"
            >
              {state === 'submitting' ? s.submitting : s.submit}
            </button>

            {state === 'success' ? (
              <p role="status" className="text-sm text-[var(--panel-text)]">
                {s.success}
              </p>
            ) : null}
            {state === 'error' ? (
              <p role="alert" className="text-sm text-[var(--panel-text)]">
                {s.error}
              </p>
            ) : null}
          </form>
        )}
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-[var(--panel-muted)]">{s.linksTitle}</h3>
        <ul className="flex max-w-md flex-col gap-2 text-sm text-[var(--panel-text)]">
          <li className="flex items-center justify-between rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 py-3">
            {s.helpCenter}
          </li>
          <li className="flex items-center justify-between rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 py-3">
            {s.feedback}
          </li>
          <li className="flex items-center justify-between rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 py-3">
            <span>{s.appVersion}</span>
            <span className="text-[var(--panel-muted)]">{APP_VERSION}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
