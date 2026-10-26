import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { Switch } from '@/shared/design-system/Switch'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { logAdminAction } from '../admin-log'
import { listFeatureFlags, setFeatureFlag } from '../feature-flags-admin'
import type { AdminFeatureFlagRow } from '../feature-flags-admin'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Coupe-circuits (lot I2, §1) : interrupteurs avec libellé, description, dernier
 * modificateur, confirmation avant de couper (jamais avant de réactiver — restaurer une
 * fonctionnalité n'a rien de risqué). Le drapeau « maintenance » porte en plus un message
 * modifiable, affiché tel quel dans le bandeau (voir MaintenanceBanner).
 */
export function AdminFeaturesPanel() {
  const s = strings.admin.features
  const { user } = useAuth()
  const { showToast } = useToast()
  const [flags, setFlags] = useState<AdminFeatureFlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [confirmKey, setConfirmKey] = useState<string | null>(null)
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')

  useEffect(() => {
    void listFeatureFlags().then((rows) => {
      setFlags(rows)
      setLoading(false)
    })
  }, [])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const applyToggle = (flag: AdminFeatureFlagRow, nextEnabled: boolean) => {
    if (!user) return
    setPendingKey(flag.key)
    void setFeatureFlag(flag.key, nextEnabled).then((updated) => {
      setPendingKey(null)
      if (!updated) {
        showToast({ type: 'error', message: s.saveError })
        return
      }
      setFlags((current) => current.map((item) => (item.key === flag.key ? updated : item)))
      void logAdminAction(
        user.id,
        nextEnabled ? 'feature_flag.enable' : 'feature_flag.disable',
        flag.key,
      )
    })
  }

  const handleToggle = (flag: AdminFeatureFlagRow) => {
    const nextEnabled = !flag.enabled
    // Couper une fonctionnalité demande une confirmation ; la réactiver n'en a pas besoin.
    if (!nextEnabled) {
      setConfirmKey(flag.key)
      return
    }
    applyToggle(flag, nextEnabled)
  }

  const handleSaveMessage = (flag: AdminFeatureFlagRow) => {
    if (!user) return
    setPendingKey(flag.key)
    void setFeatureFlag(flag.key, flag.enabled, draftMessage).then((updated) => {
      setPendingKey(null)
      setEditingMessageKey(null)
      if (!updated) {
        showToast({ type: 'error', message: s.saveError })
        return
      }
      setFlags((current) => current.map((item) => (item.key === flag.key ? updated : item)))
      void logAdminAction(user.id, 'feature_flag.edit_message', flag.key)
    })
  }

  if (loading) return null

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-lg text-sm text-[var(--muted)]">{s.intro}</p>

      <div className="flex flex-col gap-2">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--text)]">{flag.label}</span>
                <span className="text-xs text-[var(--muted)]">{flag.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={flag.enabled}
                aria-label={flag.label}
                disabled={pendingKey === flag.key}
                onClick={() => handleToggle(flag)}
                className="shrink-0 disabled:opacity-50"
              >
                <Switch
                  checked={flag.enabled}
                  onChange={() => handleToggle(flag)}
                  label={flag.label}
                  interactive={false}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
              <span>
                {flag.updated_by
                  ? `${s.lastUpdatedBy} ${flag.updated_by.slice(0, 8)} ${s.lastUpdatedAt} ${formatWhen(flag.updated_at)}`
                  : s.never}
              </span>
              {flag.key === 'maintenance' ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessageKey(flag.key)
                    setDraftMessage(flag.description)
                  }}
                  className="text-[var(--accent)] underline-offset-2 hover:underline"
                >
                  {s.editMessage}
                </button>
              ) : null}
            </div>

            {editingMessageKey === flag.key ? (
              <div className="flex flex-col gap-2 pt-1">
                <label htmlFor={`flag-message-${flag.key}`} className="text-xs text-[var(--muted)]">
                  {s.messageLabel}
                </label>
                <textarea
                  id={`flag-message-${flag.key}`}
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={s.messagePlaceholder}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-[var(--line)] bg-transparent p-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleSaveMessage(flag)}
                    disabled={pendingKey === flag.key}
                    className="h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)] disabled:opacity-50"
                  >
                    {pendingKey === flag.key ? s.saving : s.save}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingMessageKey(null)}
                    className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                  >
                    {s.cancel}
                  </button>
                </div>
              </div>
            ) : null}

            {confirmKey === flag.key ? (
              <div className="flex flex-col gap-2 rounded-xl border border-[#E5484D] p-3">
                <p className="text-sm text-[var(--text)]">{s.confirmDisableTitle}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmKey(null)
                      applyToggle(flag, false)
                    }}
                    className="h-9 rounded-lg bg-[#E5484D] px-3 text-xs font-medium text-white"
                  >
                    {s.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmKey(null)}
                    className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                  >
                    {s.cancel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
