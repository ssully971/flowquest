import { useEffect, useState } from 'react'

import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'

import { listAdminLog } from '../journal-admin'
import type { AdminLogRow } from '@/shared/supabase/database.types'

const PAGE_SIZE = 50

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
 * Journal, lecture seule (lot I2, §3) : liste filtrable de admin_log (qui, quoi, quand),
 * jamais de contenu — seulement des identifiants (action, cible), jamais le texte d'une
 * citation ou d'un message modifié.
 */
export function AdminJournalPanel() {
  const s = strings.admin.journal
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AdminLogRow[]>([])
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setLoading(true)
      void listAdminLog(limit, search || null).then((data) => {
        setRows(data)
        setLoading(false)
      })
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [search, limit])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={search}
        onChange={(event) => {
          setLimit(PAGE_SIZE)
          setSearch(event.target.value)
        }}
        placeholder={s.searchPlaceholder}
        className="h-10 w-full max-w-sm rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
      />

      {loading ? (
        <p className="text-sm text-[var(--muted)]">{s.loading}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{s.empty}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--line)]">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
                <th className="px-3 py-2 font-medium">{s.columnWhen}</th>
                <th className="px-3 py-2 font-medium">{s.columnWho}</th>
                <th className="px-3 py-2 font-medium">{s.columnAction}</th>
                <th className="px-3 py-2 font-medium">{s.columnTarget}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-[var(--muted)]">
                    {formatWhen(row.created_at)}
                  </td>
                  <td className="px-3 py-2 text-[var(--text)]">
                    {row.admin_username ?? s.unknownAdmin}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--text)]">{row.action}</td>
                  <td
                    className="max-w-[16rem] truncate px-3 py-2 text-[var(--muted)]"
                    title={row.target}
                  >
                    {row.target}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && rows.length >= limit ? (
        <button
          type="button"
          onClick={() => setLimit((current) => current + PAGE_SIZE)}
          className="h-10 w-fit rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
        >
          {s.loadMore}
        </button>
      ) : null}
    </div>
  )
}
