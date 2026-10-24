import type { FormEvent } from 'react'
import { useState } from 'react'

import { AvatarEditor } from '@/features/avatar/components/AvatarEditor'
import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'
import { useUsernameAvailability } from '../useUsernameAvailability'
import { getUsernameFormatIssue } from '../validation'
import { DeleteAccountSection } from './DeleteAccountSection'

const USERNAME_FORMAT_ERRORS = {
  tooShort: strings.auth.errors.usernameTooShort,
  tooLong: strings.auth.errors.usernameTooLong,
  invalidChars: strings.auth.errors.usernameInvalidChars,
  reserved: strings.auth.errors.usernameReserved,
}

export function AccountSummary() {
  const { user, profile, signOut, updateUsername } = useAuth()
  const [username, setUsername] = useState(profile?.username ?? '')
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const isUnchanged = username === profile?.username
  const usernameFormatIssue = getUsernameFormatIssue(username)
  const availability = useUsernameAvailability(
    username,
    !isUnchanged && username.length > 0 && !usernameFormatIssue,
  )

  if (!profile || !user) return null

  const usernameError =
    submitError ??
    (isUnchanged || username.length === 0
      ? null
      : usernameFormatIssue
        ? USERNAME_FORMAT_ERRORS[usernameFormatIssue]
        : availability === 'taken'
          ? strings.auth.errors.usernameTaken
          : null)

  const handleUsernameSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitError(null)
    if (isUnchanged) return
    if (usernameFormatIssue) {
      setSubmitError(USERNAME_FORMAT_ERRORS[usernameFormatIssue])
      return
    }
    if (availability === 'taken') {
      setSubmitError(strings.auth.errors.usernameTaken)
      return
    }
    setIsSavingUsername(true)
    try {
      await updateUsername(username)
    } catch {
      // déjà notifié par le toast
    } finally {
      setIsSavingUsername(false)
    }
  }

  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div className="flex items-center gap-4">
        <AvatarEditor
          userId={profile.id}
          username={profile.username}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
          avatarVersion={profile.avatar_version}
        />
        <div className="flex flex-col">
          <span className="text-sm text-[var(--panel-muted)]">
            {strings.auth.account.signedInAs}
          </span>
          <span className="text-sm font-medium text-[var(--panel-text)]">{user.email}</span>
        </div>
      </div>

      {profile.role === 'admin' ? (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-3.5 py-2 text-sm text-[var(--panel-text)]">
          <span className="text-[var(--panel-muted)]">{strings.auth.account.role} :</span>
          {strings.auth.account.roleAdmin}
        </div>
      ) : null}

      <form
        onSubmit={(event) => void handleUsernameSubmit(event)}
        className="flex flex-col gap-1.5"
      >
        <label htmlFor="account-username" className="text-sm font-medium text-[var(--panel-text)]">
          {strings.auth.account.usernameLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="account-username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="h-11 flex-1 rounded-xl border border-[var(--panel-line)] bg-transparent px-3.5 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={
              isSavingUsername ||
              isUnchanged ||
              usernameFormatIssue !== null ||
              availability === 'checking' ||
              availability === 'taken'
            }
            className="shrink-0 rounded-xl border border-[var(--panel-line)] px-4 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-40"
          >
            {isSavingUsername
              ? strings.auth.account.usernameSaving
              : strings.auth.account.usernameSave}
          </button>
        </div>
        {usernameError ? (
          <p role="alert" className="text-sm text-[#E5484D]">
            {usernameError}
          </p>
        ) : null}
      </form>

      <button
        type="button"
        onClick={() => void handleSignOut()}
        disabled={isSigningOut}
        className="h-11 w-fit rounded-xl border border-[var(--panel-line)] px-5 text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-60"
      >
        {isSigningOut ? strings.auth.account.signingOut : strings.auth.account.signOut}
      </button>

      <DeleteAccountSection />
    </div>
  )
}
