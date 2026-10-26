import { useState } from 'react'

import { AccountSummary } from '@/features/auth/components/AccountSummary'
import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm'
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm'
import { SignInForm } from '@/features/auth/components/SignInForm'
import { SignUpForm } from '@/features/auth/components/SignUpForm'
import { useAuth } from '@/features/auth/useAuth'
import { LocalBackupSection } from '@/features/backup/components/LocalBackupSection'
import { InviteFriendSection } from '@/features/invites/components/InviteFriendSection'
import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { strings } from '@/shared/i18n'

export function AccountPage() {
  const {
    status,
    isSupabaseConfigured,
    profileState,
    profileError,
    profileErrorDetails,
    retryLoadProfile,
    isPasswordRecovery,
  } = useAuth()
  const [tab, setTab] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn')
  const signupsEnabled = useFeatureFlag('signups')

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
      ) : isPasswordRecovery ? (
        <ResetPasswordForm />
      ) : status === 'loading' ? (
        <p className="text-sm text-[var(--panel-muted)]">{strings.auth.loading}</p>
      ) : status === 'authenticated' ? (
        profileState === 'error' ? (
          <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] p-5">
            <p role="alert" className="text-sm text-[var(--panel-text)]">
              {profileError}
            </p>
            <button
              type="button"
              onClick={retryLoadProfile}
              className="h-10 w-fit rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-colors duration-200 hover:bg-[var(--panel-line)]"
            >
              {strings.auth.profile.retry}
            </button>
            {profileErrorDetails ? (
              <details className="text-xs text-[var(--panel-muted)]">
                <summary className="cursor-pointer select-none">
                  {strings.auth.profile.technicalDetails}
                </summary>
                <p className="mt-1 whitespace-pre-wrap break-words font-mono">
                  {profileErrorDetails}
                </p>
              </details>
            ) : null}
          </div>
        ) : profileState === 'loaded' ? (
          <>
            <AccountSummary />
            <InviteFriendSection />
          </>
        ) : (
          <p className="text-sm text-[var(--panel-muted)]">{strings.auth.profile.loading}</p>
        )
      ) : (
        <div className="flex flex-col gap-6">
          {tab !== 'forgotPassword' ? (
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
              {signupsEnabled ? (
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
              ) : null}
            </div>
          ) : null}
          {tab === 'signIn' ? (
            <SignInForm
              onSwitchToSignUp={() => setTab('signUp')}
              onForgotPassword={() => setTab('forgotPassword')}
            />
          ) : tab === 'signUp' ? (
            signupsEnabled ? (
              <SignUpForm onSwitchToSignIn={() => setTab('signIn')} />
            ) : (
              <p className="max-w-sm text-sm text-[var(--panel-muted)]">
                {strings.auth.signUp.closed}
              </p>
            )
          ) : (
            <ForgotPasswordForm onBack={() => setTab('signIn')} />
          )}
        </div>
      )}

      <LocalBackupSection />
    </div>
  )
}
