import { useState } from 'react'

import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { deleteUserNuclear } from '../admin-delete-user'

interface AdminDeleteUserDialogProps {
  userId: string
  username: string
  onDeleted: () => void
  onCancel: () => void
}

/**
 * Suppression « nucléaire » (LOT I3, §5, demande RGPD) : double confirmation en tapant le
 * pseudo exact (comparaison stricte côté serveur, admin_delete_user — voir
 * 0044_admin_delete_user.sql), jamais un simple « oui ». L'interface ne vérifie pas
 * elle-même la correspondance : le serveur reste la seule source de vérité.
 */
export function AdminDeleteUserDialog({
  userId,
  username,
  onDeleted,
  onCancel,
}: AdminDeleteUserDialogProps) {
  const s = strings.admin.deleteUser
  const { showToast } = useToast()
  const [confirmValue, setConfirmValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = () => {
    setSubmitting(true)
    setError(null)
    void deleteUserNuclear(userId, confirmValue)
      .then(() => {
        showToast({ type: 'success', message: s.success })
        onDeleted()
      })
      .catch((err: unknown) => {
        setSubmitting(false)
        const message = err instanceof Error ? err.message : ''
        setError(message.includes('ne correspond pas') ? s.mismatchError : s.genericError)
      })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E5484D] p-4">
      <p className="text-sm font-medium text-[var(--text)]">{s.title}</p>
      <p className="text-xs text-[var(--muted)]">{s.warning}</p>
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        {s.confirmLabel}{' '}
        <span className="font-mono font-medium text-[var(--text)]">{username}</span>
        <input
          value={confirmValue}
          onChange={(event) => setConfirmValue(event.target.value)}
          placeholder={s.confirmPlaceholder}
          className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
        />
      </label>
      {error ? <p className="text-xs text-[#E5484D]">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={submitting || confirmValue.length === 0}
          onClick={handleSubmit}
          className="h-9 rounded-lg px-3 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: '#E5484D' }}
        >
          {submitting ? s.submitting : s.submit}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
        >
          {s.cancel}
        </button>
      </div>
    </div>
  )
}
