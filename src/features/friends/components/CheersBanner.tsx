import { X } from 'lucide-react'

import { Avatar } from '@/features/avatar/components/Avatar'
import { strings } from '@/shared/i18n'

import type { UnreadCheer } from '../types'

interface CheersBannerProps {
  cheers: UnreadCheer[]
  onDismiss: () => void
}

/** Petit bandeau non bloquant (LOT F2, §2) : affiché globalement (AppShell), jamais
 * pendant que le destinataire est en focus (géré par useCheers), toujours regroupé
 * plutôt qu'un toast par encouragement. */
export function CheersBanner({ cheers, onDismiss }: CheersBannerProps) {
  if (cheers.length === 0) return null
  const s = strings.friends.cheers

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        role="status"
        className="glass-panel pointer-events-auto flex w-full max-w-sm flex-col gap-2 rounded-2xl p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--text)]">{s.title}</p>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={s.dismiss}
            className="-m-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {cheers.map((cheer) => (
            <li key={cheer.id} className="flex items-center gap-2 text-sm text-[var(--text)]">
              <Avatar
                userId={cheer.sender.id}
                username={cheer.sender.username}
                displayName={cheer.sender.displayName}
                avatarUrl={cheer.sender.avatarUrl}
                avatarVersion={cheer.sender.avatarVersion}
                size="xs"
              />
              <span className="truncate">
                <strong className="font-medium">{cheer.sender.displayName || cheer.sender.username}</strong>{' '}
                {s.sent} {cheer.emoji}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
