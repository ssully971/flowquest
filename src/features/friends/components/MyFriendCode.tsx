import { Check, Copy, RefreshCw, Share2 } from 'lucide-react'
import { useState } from 'react'

import { strings } from '@/shared/i18n'

interface MyFriendCodeProps {
  code: string
  onRegenerate: () => Promise<string | null>
}

/** Code ami de 8 caractères (§2 du Mode Amis), avec copie et partage (Web Share API si
 * disponible) — et régénération (demande explicitement un nouveau code, l'ancien cesse
 * de fonctionner). */
export function MyFriendCode({ code, onRegenerate }: MyFriendCodeProps) {
  const s = strings.friends.myCode
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permission refusée) : la
      // valeur reste visible à l'écran, copiable manuellement.
    }
  }

  const handleShare = () => {
    void navigator.share({ text: code }).catch(() => {
      // Partage annulé par la personne ou indisponible : pas d'erreur à afficher.
    })
  }

  const handleRegenerate = () => {
    if (window.confirm(s.regenerateConfirm)) void onRegenerate()
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-medium text-[var(--muted)]">{s.title}</p>
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono text-lg font-semibold tracking-[0.2em] text-[var(--text)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {code}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={copied ? s.copied : s.copy}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          >
            {copied ? (
              <Check size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Copy size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          {canShare ? (
            <button
              type="button"
              onClick={handleShare}
              aria-label={s.share}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
            >
              <Share2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleRegenerate}
            aria-label={s.regenerate}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)]"
          >
            <RefreshCw size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)]">{s.hint}</p>
    </div>
  )
}
