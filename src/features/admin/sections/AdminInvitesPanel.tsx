import { useCallback, useEffect, useState } from 'react'

import { InviteCodeDisplay } from '@/features/invites/components/InviteCodeDisplay'
import { formatInviteDate } from '@/features/invites/invite-code'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'
import type { AdminInviteCodeRow, InviteCodeIssued } from '@/shared/supabase/database.types'
import { useToast } from '@/shared/toast'

import {
  generateAdminInviteCode,
  listAdminInviteCodes,
  revokeInviteCode,
} from '../invite-codes-admin'

/**
 * Codes d'accès (bêta fermée) : génération d'un code admin (12 h), liste des codes récents
 * avec statut, révocation. Toute la logique (expiration, usage unique, journalisation dans
 * admin_log) vit dans les fonctions SQL ; ce panneau ne fait que les appeler et les afficher.
 */
export function AdminInvitesPanel() {
  const s = strings.admin.invites
  const { showToast } = useToast()
  const [rows, setRows] = useState<AdminInviteCodeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [issued, setIssued] = useState<InviteCodeIssued | null>(null)

  const reload = useCallback(async () => {
    try {
      setRows(await listAdminInviteCodes())
      setLoadFailed(false)
    } catch {
      setLoadFailed(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void listAdminInviteCodes()
      .then((data) => setRows(data))
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      setIssued(await generateAdminInviteCode())
      await reload()
    } catch {
      showToast({ type: 'error', message: s.generateError })
    } finally {
      setGenerating(false)
    }
  }

  const handleRevoke = async (row: AdminInviteCodeRow) => {
    setRevokingId(row.id)
    try {
      await revokeInviteCode(row.id)
      if (issued?.code === row.code) setIssued(null)
      await reload()
    } catch {
      showToast({ type: 'error', message: s.revokeError })
    } finally {
      setRevokingId(null)
    }
  }

  const statusLabel = {
    active: s.statusActive,
    used: s.statusUsed,
    expired: s.statusExpired,
  } as const

  return (
    <div className="flex max-w-xl flex-col gap-5">
      <p className="text-sm text-[var(--muted)]">{s.intro}</p>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={generating}
        className="h-11 w-fit rounded-xl bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--on-accent)] disabled:opacity-60"
      >
        {generating ? s.generating : s.generate}
      </button>

      {issued ? (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-[var(--text)]">{s.newCodeTitle}</h2>
          <InviteCodeDisplay
            code={issued.code}
            expiresAt={issued.expires_at}
            expiresLabel={s.expiresAt}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--text)]">{s.recentTitle}</h2>
        {loading ? (
          <p className="text-sm text-[var(--muted)]">{s.loading}</p>
        ) : loadFailed ? (
          <p role="alert" className="text-sm text-[#E5484D]">
            {s.loadError}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--line)] px-4 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-mono text-sm tracking-widest text-[var(--text)]">
                    {row.code}
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {statusLabel[row.status]}
                    {row.status === 'used'
                      ? ` ${s.usedByPrefix} ${row.used_by_username ?? s.unknownUser}${
                          row.used_at ? ` ${s.usedAtPrefix} ${formatInviteDate(row.used_at)}` : ''
                        }`
                      : row.expires_at
                        ? ` — ${s.expiresAt} ${formatInviteDate(row.expires_at)}`
                        : ''}
                  </span>
                </div>
                {row.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => void handleRevoke(row)}
                    disabled={revokingId === row.id}
                    className="h-9 shrink-0 rounded-lg border border-[#E5484D] px-3 text-xs font-medium text-[#E5484D] disabled:opacity-50"
                  >
                    {revokingId === row.id ? s.revoking : s.revoke}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
