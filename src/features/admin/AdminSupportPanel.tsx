import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { logAdminAction } from './admin-log'
import { listSupportMessages, setSupportMessageStatus } from './support-admin'
import type { AdminSupportMessageRow } from './support-admin'

type Filter = 'all' | 'pending' | 'processed'

export function AdminSupportPanel() {
  const s = strings.admin.support
  const { user } = useAuth()
  const { showToast } = useToast()
  const [messages, setMessages] = useState<AdminSupportMessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')

  useEffect(() => {
    void listSupportMessages().then((rows) => {
      setMessages(rows)
      setLoading(false)
    })
  }, [])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const handleToggleStatus = (message: AdminSupportMessageRow) => {
    if (!user) return
    const nextStatus = message.status === 'pending' ? 'processed' : 'pending'
    void setSupportMessageStatus(message.id, nextStatus).then((ok) => {
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setMessages((current) =>
        current.map((candidate) =>
          candidate.id === message.id ? { ...candidate, status: nextStatus } : candidate,
        ),
      )
      void logAdminAction(
        user.id,
        nextStatus === 'processed' ? 'support.markProcessed' : 'support.markPending',
        message.id,
      )
    })
  }

  const filtered = messages.filter((message) => filter === 'all' || message.status === filter)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['pending', 'processed', 'all'] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={filter === candidate}
            onClick={() => setFilter(candidate)}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
              filter === candidate
                ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                : 'border border-[var(--line)] text-[var(--muted)]'
            }`}
          >
            {candidate === 'pending' ? s.filterPending : candidate === 'processed' ? s.filterProcessed : s.filterAll}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {!loading && filtered.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty}</p>
        ) : null}
        {filtered.map((message) => (
          <div
            key={message.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
          >
            <div className="flex flex-col gap-1">
              <p className="text-xs text-[var(--muted)]">
                {message.email || s.guestEmail} ·{' '}
                {new Date(message.created_at).toLocaleString('fr-FR')} ·{' '}
                {message.status === 'processed' ? s.statusProcessed : s.statusPending}
              </p>
              <p className="text-sm text-[var(--text)]">{message.body}</p>
            </div>
            <button
              type="button"
              onClick={() => handleToggleStatus(message)}
              className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text)] transition-colors duration-200 hover:border-[var(--accent)]"
            >
              {message.status === 'pending' ? s.markProcessed : s.markPending}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
