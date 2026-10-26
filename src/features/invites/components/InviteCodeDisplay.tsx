import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

import { formatInviteDate } from '../invite-code'

interface InviteCodeDisplayProps {
  code: string
  expiresAt: string | null
  /** Propose le partage natif (navigator.share) quand le navigateur le gère. */
  shareable?: boolean
  expiresLabel?: string
}

/** Code en grand + Copier (+ partage natif) + expiration, partagé par le panneau Admin et
 * la section « Inviter un ami » du profil. */
export function InviteCodeDisplay({
  code,
  expiresAt,
  shareable = false,
  expiresLabel = strings.invites.code.expiresPrefix,
}: InviteCodeDisplayProps) {
  const s = strings.invites.code
  const [copied, setCopied] = useState(false)
  const canShare =
    shareable && typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleCopy = () => {
    void navigator.clipboard
      ?.writeText(code)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // Presse-papiers refusé : le code reste affiché et sélectionnable.
      })
  }

  const handleShare = () => {
    void navigator
      .share({ title: s.shareTitle, text: `${s.shareTextPrefix} ${code}` })
      .catch(() => {
        // Partage annulé par l'utilisateur : rien à faire.
      })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--line)] p-4">
      <p
        data-testid="invite-code"
        className="select-all text-center text-3xl font-semibold tracking-[0.3em] text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {code}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)]"
        >
          {copied ? (
            <Check size={14} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Copy size={14} strokeWidth={2} aria-hidden="true" />
          )}
          {copied ? s.copied : s.copy}
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)]"
          >
            <Share2 size={14} strokeWidth={2} aria-hidden="true" />
            {s.share}
          </button>
        ) : null}
      </div>
      {expiresAt ? (
        <p className="text-center text-xs text-[var(--muted)]">
          {expiresLabel} {formatInviteDate(expiresAt)}
        </p>
      ) : null}
    </div>
  )
}
