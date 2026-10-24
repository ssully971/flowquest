import type { FormEvent } from 'react'
import { useState } from 'react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'

import type { FriendProfilePreview } from '../types'

interface AddFriendFormProps {
  onPreview: (query: { code: string } | { username: string }) => Promise<FriendProfilePreview | null>
  onSend: (query: { code: string } | { username: string }) => Promise<boolean>
}

type Mode = 'code' | 'username'

/**
 * Ajout par code ami ou par pseudo EXACT (LOT F1, §2) : un aperçu confirme l'identité
 * avant l'envoi réel de la demande, jamais de recherche partielle côté serveur (voir
 * find_profile_preview(), migration 0022) — ni d'indication ici que la recherche échoue
 * parce que le compte est banni ou t'a bloqué (message générique dans les deux cas).
 */
export function AddFriendForm({ onPreview, onSend }: AddFriendFormProps) {
  const s = strings.friends.add
  const [mode, setMode] = useState<Mode>('code')
  const [value, setValue] = useState('')
  const [preview, setPreview] = useState<FriendProfilePreview | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const buildQuery = (raw: string): { code: string } | { username: string } =>
    mode === 'code' ? { code: raw.trim() } : { username: raw.trim() }

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setIsSearching(true)
    setNotFound(false)
    setPreview(null)
    try {
      const result = await onPreview(buildQuery(trimmed))
      if (result) setPreview(result)
      else setNotFound(true)
    } finally {
      setIsSearching(false)
    }
  }

  const handleSend = async () => {
    if (!preview) return
    setIsSending(true)
    const ok = await onSend(buildQuery(value.trim()))
    setIsSending(false)
    if (ok) {
      setValue('')
      setPreview(null)
      setNotFound(false)
    }
  }

  const handleModeChange = (next: Mode) => {
    setMode(next)
    setValue('')
    setPreview(null)
    setNotFound(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1">
        <button
          type="button"
          onClick={() => handleModeChange('code')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
            mode === 'code' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
          }`}
        >
          {s.byCode}
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('username')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
            mode === 'username' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
          }`}
        >
          {s.byUsername}
        </button>
      </div>

      <form onSubmit={(event) => void handleSearch(event)} className="flex flex-col gap-1.5">
        <label htmlFor="friend-add-value" className="text-sm font-medium text-[var(--text)]">
          {mode === 'code' ? s.codeLabel : s.usernameLabel}
        </label>
        <div className="flex gap-2">
          <input
            id="friend-add-value"
            type="text"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setPreview(null)
              setNotFound(false)
            }}
            placeholder={mode === 'code' ? s.codePlaceholder : s.usernamePlaceholder}
            className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3.5 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={isSearching || value.trim().length === 0}
            className="shrink-0 rounded-xl border border-[var(--line)] px-4 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:opacity-40"
          >
            {isSearching ? s.searching : '→'}
          </button>
        </div>
        {notFound ? <p className="text-sm text-[var(--muted)]">{s.notFound}</p> : null}
      </form>

      {preview ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3.5 py-3">
          <Avatar
            userId={preview.id}
            username={preview.username}
            displayName={preview.displayName}
            avatarUrl={preview.avatarUrl}
            avatarVersion={preview.avatarVersion}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-[var(--text)]">
              {preview.displayName || preview.username}
            </span>
            <span className="truncate text-xs text-[var(--muted)]">@{preview.username}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending}
            className="shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-2 text-xs font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
          >
            {isSending ? s.sending : s.send}
          </button>
        </div>
      ) : null}
    </div>
  )
}
