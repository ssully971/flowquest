import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { logAdminAction } from './admin-log'
import {
  createChangelogEntry,
  deleteChangelogEntry,
  listAllChangelogEntries,
  setChangelogEntryActive,
} from './changelog-admin'
import type { AdminChangelogRow } from './changelog-admin'

type AddState = 'idle' | 'adding'

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function AdminChangelogPanel() {
  const s = strings.admin.changelog
  const { user } = useAuth()
  const { showToast } = useToast()
  const [entries, setEntries] = useState<AdminChangelogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [version, setVersion] = useState('')
  const [releasedAt, setReleasedAt] = useState(todayIsoDate)
  const [body, setBody] = useState('')
  const [addState, setAddState] = useState<AddState>('idle')

  useEffect(() => {
    void listAllChangelogEntries().then((rows) => {
      setEntries(rows)
      setLoading(false)
    })
  }, [])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    if (addState === 'adding' || !user) return
    setAddState('adding')
    void createChangelogEntry({ version, released_at: releasedAt, body }).then((created) => {
      setAddState('idle')
      if (!created) {
        showToast({ type: 'error', message: s.addError })
        return
      }
      setEntries((current) => [created, ...current])
      setVersion('')
      setBody('')
      void logAdminAction(user.id, 'changelog.create', created.id)
    })
  }

  const handleToggleActive = (entry: AdminChangelogRow) => {
    if (!user) return
    const nextActive = !entry.active
    void setChangelogEntryActive(entry.id, nextActive).then((ok) => {
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setEntries((current) =>
        current.map((candidate) =>
          candidate.id === entry.id ? { ...candidate, active: nextActive } : candidate,
        ),
      )
      void logAdminAction(
        user.id,
        nextActive ? 'changelog.activate' : 'changelog.deactivate',
        entry.id,
      )
    })
  }

  const handleDelete = (entry: AdminChangelogRow) => {
    if (!user) return
    if (!window.confirm(s.confirmRemove)) return
    void deleteChangelogEntry(entry.id).then((ok) => {
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setEntries((current) => current.filter((candidate) => candidate.id !== entry.id))
      void logAdminAction(user.id, 'changelog.delete', entry.id)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex max-w-md flex-col gap-3">
        <h3 className="text-sm font-medium text-[var(--muted)]">{s.newTitle}</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="changelog-version" className="mb-1 block text-xs text-[var(--muted)]">
              {s.versionLabel}
            </label>
            <input
              id="changelog-version"
              required
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              placeholder={s.versionPlaceholder}
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
            />
          </div>
          <div className="flex-1">
            <label htmlFor="changelog-date" className="mb-1 block text-xs text-[var(--muted)]">
              {s.dateLabel}
            </label>
            <input
              id="changelog-date"
              type="date"
              required
              value={releasedAt}
              onChange={(event) => setReleasedAt(event.target.value)}
              className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
            />
          </div>
        </div>
        <div>
          <label htmlFor="changelog-body" className="mb-1 block text-xs text-[var(--muted)]">
            {s.bodyLabel}
          </label>
          <textarea
            id="changelog-body"
            required
            maxLength={2000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={s.bodyPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          disabled={addState === 'adding'}
          className="h-10 w-fit rounded-xl bg-[var(--accent)] px-5 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-50"
        >
          {addState === 'adding' ? s.adding : s.add}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {!loading && entries.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty}</p>
        ) : null}
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-[var(--text)]">
                {entry.version} · {entry.released_at}
              </p>
              <p className="text-sm text-[var(--text)]">{entry.body}</p>
              <p className="text-xs text-[var(--muted)]">{entry.active ? s.active : s.inactive}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handleToggleActive(entry)}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text)] transition-colors duration-200 hover:border-[var(--accent)]"
              >
                {entry.active ? s.deactivate : s.activate}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(entry)}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text)] transition-colors duration-200 hover:border-[var(--accent)]"
              >
                {s.remove}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
