import { useState } from 'react'

import { AccountSummary } from '@/features/auth/components/AccountSummary'
import { SignInForm } from '@/features/auth/components/SignInForm'
import { SignUpForm } from '@/features/auth/components/SignUpForm'
import { useAuth } from '@/features/auth/useAuth'
import { strings } from '@/shared/i18n'

export function AccountPage() {
  const { status, isSupabaseConfigured } = useAuth()
  const [tab, setTab] = useState<'signIn' | 'signUp'>('signIn')

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {strings.settings.nav.account}
      </h2>

      {!isSupabaseConfigured ? (
        <p className="max-w-sm text-sm text-[var(--panel-muted)]">{strings.auth.notConfigured}</p>
      ) : status === 'loading' ? (
        <p className="text-sm text-[var(--panel-muted)]">{strings.auth.loading}</p>
      ) : status === 'authenticated' ? (
        <AccountSummary />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--panel-line)] p-1">
            <button
              type="button"
              onClick={() => setTab('signIn')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                tab === 'signIn'
                  ? 'bg-[var(--panel-surface-2)] text-[var(--panel-text)]'
                  : 'text-[var(--panel-muted)]'
              }`}
            >
              {strings.auth.signIn.tab}
            </button>
            <button
              type="button"
              onClick={() => setTab('signUp')}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-200 ${
                tab === 'signUp'
                  ? 'bg-[var(--panel-surface-2)] text-[var(--panel-text)]'
                  : 'text-[var(--panel-muted)]'
              }`}
            >
              {strings.auth.signUp.tab}
            </button>
          </div>
          {tab === 'signIn' ? (
            <SignInForm onSwitchToSignUp={() => setTab('signUp')} />
          ) : (
            <SignUpForm onSwitchToSignIn={() => setTab('signIn')} />
          )}
        </div>
      )}
    </div>
  )
}
