import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { strings } from '@/shared/i18n'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import type { AdminUserRow, AdminUserStatus } from '@/shared/supabase/database.types'
import { useToast } from '@/shared/toast'

import { logAdminAction } from '../admin-log'
import {
  banUser,
  exportAdminUsers,
  listAdminUsers,
  removeUserAvatar,
  suspendUser,
  unbanUser,
  unsuspendUser,
} from '../admin-users'
import type { AdminUserSort } from '../admin-users'
import { downloadUsersCsv } from '../export-users-csv'
import { AdminUserDetail } from './AdminUserDetail'

const PAGE_SIZE = 20

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function statusLabel(status: AdminUserStatus, s: typeof strings.admin.users): string {
  if (status === 'suspended') return s.statusSuspended
  if (status === 'banned') return s.statusBanned
  return s.statusActive
}

function statusColor(status: AdminUserStatus): string {
  if (status === 'banned') return '#E5484D'
  if (status === 'suspended') return '#F59E0B'
  return '#22C55E'
}

type ActionKey =
  | 'suspend1'
  | 'suspend7'
  | 'suspend30'
  | 'unsuspend'
  | 'ban'
  | 'unban'
  | 'removeAvatar'
  | 'resetPassword'

/**
 * Visionneuse d'utilisateurs et modération (LOT I3, §1-2-4) : liste paginée/triable/
 * cherchable, actions de modération avec confirmation (sauf lever une suspension/un
 * bannissement, jamais risqué), export CSV, et ouverture du profil détaillé « god mode »
 * (AdminUserDetail) au clic sur une ligne.
 */
export function AdminUsersPanel() {
  const s = strings.admin.users
  const { user: currentAdmin, requestPasswordReset } = useAuth()
  const { showToast } = useToast()
  const [rows, setRows] = useState<AdminUserRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<AdminUserSort>('created_at_desc')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ActionKey | null>(null)
  const [reason, setReason] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  const [exporting, setExporting] = useState<'consented' | 'all' | null>(null)

  const refresh = () => {
    setLoading(true)
    setLoadError(false)
    void listAdminUsers(PAGE_SIZE, page * PAGE_SIZE, search || null, sort).then((data) => {
      setLoading(false)
      if (data.length === 0 && page > 0) {
        setRows([])
        setTotalCount(0)
        return
      }
      setRows(data)
      setTotalCount(data[0]?.total_count ?? 0)
    })
  }

  useEffect(() => {
    const timeout = window.setTimeout(refresh, 200)
    return () => window.clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sort, page])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const toggleExpanded = (userId: string) => {
    setExpandedUserId((current) => (current === userId ? null : userId))
    setConfirmAction(null)
    setReason('')
  }

  const runAction = (userId: string, action: () => Promise<boolean>) => {
    setPendingUserId(userId)
    void action().then((ok) => {
      setPendingUserId(null)
      setConfirmAction(null)
      setReason('')
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      refresh()
    })
  }

  const handleConfirmedAction = (userId: string, key: ActionKey) => {
    const trimmedReason = reason.trim() || null
    if (key === 'suspend1') runAction(userId, () => suspendUser(userId, 1, trimmedReason))
    else if (key === 'suspend7') runAction(userId, () => suspendUser(userId, 7, trimmedReason))
    else if (key === 'suspend30') runAction(userId, () => suspendUser(userId, 30, trimmedReason))
    else if (key === 'ban') runAction(userId, () => banUser(userId, trimmedReason))
    else if (key === 'removeAvatar') runAction(userId, () => removeUserAvatar(userId))
    else if (key === 'resetPassword') {
      const target = rows.find((row) => row.id === userId)
      if (!target) return
      runAction(userId, () =>
        requestPasswordReset(target.email)
          .then(() => {
            void logAdminAction(currentAdmin?.id ?? '', 'reset_password_email', userId)
            showToast({ type: 'success', message: s.resetPasswordSent })
            return true
          })
          .catch(() => false),
      )
    }
  }

  const handleExport = (mode: 'consented' | 'all') => {
    setExporting(mode)
    void exportAdminUsers(mode === 'consented').then((data) => {
      setExporting(null)
      downloadUsersCsv(
        data,
        mode === 'consented' ? s.export.filenameConsented : s.export.filenameAll,
      )
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(event) => {
            setPage(0)
            setSearch(event.target.value)
          }}
          placeholder={s.searchPlaceholder}
          className="h-10 w-full max-w-sm rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
        />
        <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
          {s.sortLabel}
          <select
            value={sort}
            onChange={(event) => {
              setPage(0)
              setSort(event.target.value as AdminUserSort)
            }}
            className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-xs text-[var(--text)] outline-none"
          >
            <option value="created_at_desc">{s.sortCreatedDesc}</option>
            <option value="created_at_asc">{s.sortCreatedAsc}</option>
            <option value="last_active_desc">{s.sortLastActiveDesc}</option>
            <option value="username_asc">{s.sortUsernameAsc}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--line)] p-3">
        <button
          type="button"
          onClick={() => handleExport('consented')}
          disabled={exporting !== null}
          className="h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)] disabled:opacity-50"
        >
          {exporting === 'consented' ? s.export.exporting : s.export.button}
        </button>
        <button
          type="button"
          onClick={() => handleExport('all')}
          disabled={exporting !== null}
          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)] disabled:opacity-50"
        >
          {exporting === 'all' ? s.export.exporting : s.export.allAccounts}
        </button>
        <p className="w-full text-xs text-[var(--muted)]">{s.export.warning}</p>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{s.loading}</p>
      ) : loadError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--muted)]">{s.loadError}</p>
          <button
            type="button"
            onClick={refresh}
            className="text-sm text-[var(--accent)] underline-offset-2 hover:underline"
          >
            {s.retry}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{s.empty}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-[var(--line)]">
              <button
                type="button"
                onClick={() => toggleExpanded(row.id)}
                className="flex w-full flex-col gap-1 px-4 py-3 text-left sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-[var(--text)]">{row.username}</span>
                  <span className="text-xs text-[var(--muted)]">{row.email}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <span>
                    {s.columnCreatedAt} : {formatDate(row.created_at)}
                  </span>
                  <span>
                    {s.columnLastActive} :{' '}
                    {row.last_active_at ? formatDate(row.last_active_at) : s.never}
                  </span>
                  {row.role === 'admin' ? (
                    <span className="rounded-full border border-[var(--line)] px-2 py-0.5">
                      {s.roleAdmin}
                    </span>
                  ) : null}
                  <span
                    className="rounded-full px-2 py-0.5 font-medium text-white"
                    style={{ background: statusColor(row.status) }}
                  >
                    {statusLabel(row.status, s)}
                  </span>
                </div>
              </button>

              {expandedUserId === row.id ? (
                <div className="flex flex-col gap-3 border-t border-[var(--line)] px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailUserId(row.id)}
                      className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                    >
                      {s.openProfile}
                    </button>
                    {row.role !== 'admin' && row.id !== currentAdmin?.id ? (
                      <>
                        {row.status === 'suspended' ? (
                          <button
                            type="button"
                            disabled={pendingUserId === row.id}
                            onClick={() => runAction(row.id, () => unsuspendUser(row.id))}
                            className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)] disabled:opacity-50"
                          >
                            {s.actions.unsuspend}
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmAction('suspend1')}
                              className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                            >
                              {s.actions.suspend} {s.actions.suspend1d}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction('suspend7')}
                              className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                            >
                              {s.actions.suspend} {s.actions.suspend7d}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction('suspend30')}
                              className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                            >
                              {s.actions.suspend} {s.actions.suspend30d}
                            </button>
                          </>
                        )}
                        {row.status === 'banned' ? (
                          <button
                            type="button"
                            disabled={pendingUserId === row.id}
                            onClick={() => runAction(row.id, () => unbanUser(row.id))}
                            className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)] disabled:opacity-50"
                          >
                            {s.actions.unban}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmAction('ban')}
                            className="h-9 rounded-lg px-3 text-xs font-medium text-white"
                            style={{ background: '#E5484D' }}
                          >
                            {s.actions.ban}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setConfirmAction('removeAvatar')}
                          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                        >
                          {s.actions.removeAvatar}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction('resetPassword')}
                          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                        >
                          {s.actions.resetPassword}
                        </button>
                      </>
                    ) : null}
                  </div>

                  {confirmAction ? (
                    <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-3">
                      <p className="text-sm text-[var(--text)]">
                        {confirmAction === 'ban'
                          ? s.confirmBan
                          : confirmAction === 'removeAvatar'
                            ? s.confirmRemoveAvatar
                            : confirmAction === 'resetPassword'
                              ? s.confirmResetPassword
                              : s.confirmSuspend}
                      </p>
                      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                        {s.reasonLabel}
                        <input
                          value={reason}
                          onChange={(event) => setReason(event.target.value)}
                          className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={pendingUserId === row.id}
                          onClick={() => handleConfirmedAction(row.id, confirmAction)}
                          className="h-9 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)] disabled:opacity-50"
                        >
                          {s.confirm}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction(null)}
                          className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
                        >
                          {s.cancel}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {!loading && !loadError && rows.length > 0 ? (
        <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="h-9 rounded-lg border border-[var(--line)] px-3 disabled:opacity-40"
          >
            {s.previousPage}
          </button>
          <span>
            {s.pageIndicator} {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="h-9 rounded-lg border border-[var(--line)] px-3 disabled:opacity-40"
          >
            {s.nextPage}
          </button>
        </div>
      ) : null}

      {detailUserId ? (
        <AdminUserDetail
          key={detailUserId}
          userId={detailUserId}
          username={rows.find((row) => row.id === detailUserId)?.username ?? ''}
          canDelete={
            rows.find((row) => row.id === detailUserId)?.role !== 'admin' &&
            detailUserId !== currentAdmin?.id
          }
          onClose={() => setDetailUserId(null)}
          onDeleted={() => {
            setDetailUserId(null)
            refresh()
          }}
        />
      ) : null}
    </div>
  )
}
