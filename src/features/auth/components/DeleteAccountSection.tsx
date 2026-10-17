import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { useAuth } from '../useAuth'

export function DeleteAccountSection() {
  const { profile, deleteAccount } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [confirmValue, setConfirmValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  if (!profile) return null

  const canConfirm = confirmValue.length > 0 && confirmValue === profile.username

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteAccount()
    } catch {
      // déjà notifié par le toast
      setIsDeleting(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-11 w-fit rounded-xl border border-[#E5484D]/40 px-5 text-sm font-medium text-[#E5484D] transition-colors duration-200 hover:bg-[#E5484D]/10"
      >
        {strings.auth.account.deleteAccount}
      </button>
    )
  }

  return (
    <div className="flex max-w-sm flex-col gap-3 rounded-2xl border border-[#E5484D]/40 bg-[var(--panel-surface-2)] p-5">
      <p className="text-sm font-semibold text-[var(--panel-text)]">
        {strings.auth.account.deleteConfirmTitle}
      </p>
      <p className="text-sm text-[var(--panel-muted)]">{strings.auth.account.deleteConfirmBody}</p>
      <ul className="list-disc pl-5 text-sm text-[var(--panel-muted)]">
        <li>{strings.auth.account.deleteConfirmLoseTasks}</li>
        <li>{strings.auth.account.deleteConfirmLoseNotes}</li>
        <li>{strings.auth.account.deleteConfirmLoseSessions}</li>
        <li>{strings.auth.account.deleteConfirmLoseSettings}</li>
      </ul>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="delete-account-confirm"
          className="text-sm font-medium text-[var(--panel-text)]"
        >
          {strings.auth.account.deleteConfirmTypeUsername} <strong>{profile.username}</strong>
        </label>
        <input
          id="delete-account-confirm"
          type="text"
          value={confirmValue}
          onChange={(event) => setConfirmValue(event.target.value)}
          placeholder={strings.auth.account.deleteConfirmPlaceholder}
          autoComplete="off"
          className="h-11 rounded-xl border border-[var(--panel-line)] bg-transparent px-3.5 text-sm text-[var(--panel-text)] outline-none transition-colors duration-200 focus:border-[#E5484D]"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void handleDelete()}
          disabled={!canConfirm || isDeleting}
          className="h-11 flex-1 rounded-xl bg-[#E5484D] text-sm font-semibold text-white transition-opacity duration-200 disabled:opacity-40"
        >
          {isDeleting
            ? strings.auth.account.deleteConfirmSubmitting
            : strings.auth.account.deleteConfirmSubmit}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false)
            setConfirmValue('')
          }}
          disabled={isDeleting}
          className="h-11 flex-1 rounded-xl border border-[var(--panel-line)] text-sm font-medium text-[var(--panel-text)] transition-opacity duration-200 disabled:opacity-60"
        >
          {strings.auth.account.deleteConfirmCancel}
        </button>
      </div>
    </div>
  )
}
