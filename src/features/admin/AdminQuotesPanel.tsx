import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { logAdminAction } from './admin-log'
import { createQuote, deleteQuote, listAllQuotes, setQuoteActive } from './quotes-admin'
import type { AdminQuoteRow } from './quotes-admin'

type AddState = 'idle' | 'adding'

export function AdminQuotesPanel() {
  const s = strings.admin.quotes
  const { user } = useAuth()
  const { showToast } = useToast()
  const [quotes, setQuotes] = useState<AdminQuoteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [author, setAuthor] = useState('')
  const [category, setCategory] = useState<'medicine' | 'focus'>('focus')
  const [addState, setAddState] = useState<AddState>('idle')

  useEffect(() => {
    void listAllQuotes().then((rows) => {
      setQuotes(rows)
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
    void createQuote({ text, author: author.trim() ? author.trim() : null, category }).then(
      (created) => {
        setAddState('idle')
        if (!created) {
          showToast({ type: 'error', message: s.addError })
          return
        }
        setQuotes((current) => [created, ...current])
        setText('')
        setAuthor('')
        void logAdminAction(user.id, 'quote.create', created.id)
      },
    )
  }

  const handleToggleActive = (quote: AdminQuoteRow) => {
    if (!user) return
    const nextActive = !quote.active
    void setQuoteActive(quote.id, nextActive).then((ok) => {
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setQuotes((current) =>
        current.map((candidate) =>
          candidate.id === quote.id ? { ...candidate, active: nextActive } : candidate,
        ),
      )
      void logAdminAction(user.id, nextActive ? 'quote.activate' : 'quote.deactivate', quote.id)
    })
  }

  const handleDelete = (quote: AdminQuoteRow) => {
    if (!user) return
    if (!window.confirm(s.confirmRemove)) return
    void deleteQuote(quote.id).then((ok) => {
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setQuotes((current) => current.filter((candidate) => candidate.id !== quote.id))
      void logAdminAction(user.id, 'quote.delete', quote.id)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleAdd} className="flex max-w-md flex-col gap-3">
        <h3 className="text-sm font-medium text-[var(--muted)]">{s.newTitle}</h3>
        <div>
          <label htmlFor="quote-text" className="mb-1 block text-xs text-[var(--muted)]">
            {s.textLabel}
          </label>
          <textarea
            id="quote-text"
            required
            maxLength={500}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={s.textPlaceholder}
            rows={2}
            className="w-full resize-none rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <label htmlFor="quote-author" className="mb-1 block text-xs text-[var(--muted)]">
            {s.authorLabel}
          </label>
          <input
            id="quote-author"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            placeholder={s.authorPlaceholder}
            className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
        </div>
        <div>
          <span className="mb-1 block text-xs text-[var(--muted)]">{s.categoryLabel}</span>
          <div className="flex gap-2">
            <button
              type="button"
              aria-pressed={category === 'medicine'}
              onClick={() => setCategory('medicine')}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
                category === 'medicine'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {s.categoryMedicine}
            </button>
            <button
              type="button"
              aria-pressed={category === 'focus'}
              onClick={() => setCategory('focus')}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors duration-200 ${
                category === 'focus'
                  ? 'bg-[var(--accent)] text-[var(--on-accent)]'
                  : 'border border-[var(--line)] text-[var(--muted)]'
              }`}
            >
              {s.categoryFocus}
            </button>
          </div>
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
        {!loading && quotes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{s.empty}</p>
        ) : null}
        {quotes.map((quote) => (
          <div
            key={quote.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] px-4 py-3"
          >
            <div className="flex flex-col gap-1">
              <p className="text-sm text-[var(--text)]">“{quote.text}”</p>
              <p className="text-xs text-[var(--muted)]">
                {quote.author ?? ''} · {quote.category} ·{' '}
                {quote.active ? s.active : s.inactive}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => handleToggleActive(quote)}
                className="rounded-full border border-[var(--line)] px-3 py-1 text-xs text-[var(--text)] transition-colors duration-200 hover:border-[var(--accent)]"
              >
                {quote.active ? s.deactivate : s.activate}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(quote)}
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
