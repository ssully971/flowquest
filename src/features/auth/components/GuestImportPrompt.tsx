import { useEffect, useState } from 'react'

import { ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import {
  hasLocalGuestData,
  hasOfferedImport,
  importGuestDataToAccount,
  markImportOffered,
} from '../guest-import'
import { useAuth } from '../useAuth'

const RECENT_ACCOUNT_WINDOW_MS = 5 * 60 * 1000

export function GuestImportPrompt() {
  const { status, user, profile } = useAuth()
  const { showToast } = useToast()
  const [visible, setVisible] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated' || !user || !profile) return
    if (hasOfferedImport(user.id)) return

    const createdRecently =
      Date.now() - new Date(profile.created_at).getTime() < RECENT_ACCOUNT_WINDOW_MS
    if (!createdRecently) {
      markImportOffered(user.id)
      return
    }

    let cancelled = false
    void hasLocalGuestData().then((hasData) => {
      if (!cancelled && hasData) setVisible(true)
    })
    return () => {
      cancelled = true
    }
  }, [status, user, profile])

  if (!visible || !user || status !== 'authenticated') return null

  const handleSkip = () => {
    markImportOffered(user.id)
    setVisible(false)
  }

  const handleImport = async () => {
    setIsImporting(true)
    try {
      await importGuestDataToAccount(user.id)
      markImportOffered(user.id)
      showToast({ type: 'success', message: strings.auth.importPrompt.success })
    } catch {
      showToast({ type: 'error', message: strings.auth.importPrompt.error })
      markImportOffered(user.id)
    } finally {
      setIsImporting(false)
      setVisible(false)
    }
  }

  return (
    <ModalOverlay className="z-[60]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="guest-import-title"
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 text-[var(--text)] shadow-[0_10px_24px_var(--glow)]"
      >
        <h2 id="guest-import-title" className="text-lg font-semibold">
          {strings.auth.importPrompt.title}
        </h2>
        <p className="text-sm text-[var(--muted)]">{strings.auth.importPrompt.body}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isImporting}
            className="h-10 rounded-xl px-4 text-sm font-medium text-[var(--muted)] transition-opacity duration-200 disabled:opacity-60"
          >
            {strings.auth.importPrompt.skip}
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={isImporting}
            className="h-10 rounded-xl bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-60"
          >
            {isImporting ? strings.auth.importPrompt.importing : strings.auth.importPrompt.confirm}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
