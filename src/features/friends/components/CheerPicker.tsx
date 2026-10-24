import { HeartHandshake } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { strings } from '@/shared/i18n'
import type { CheerEmoji } from '@/shared/supabase/database.types'

const CHEER_EMOJIS: CheerEmoji[] = ['💪', '🔥', '👏', '❤️', '☕']

interface CheerPickerProps {
  onSend: (emoji: CheerEmoji) => void
}

/** Jeu fixe d'emojis (LOT F2, §2) : bouton qui ouvre une petite rangée de choix, envoie et
 * se referme — jamais de notification immédiate chez le destinataire (géré côté base et
 * par useCheers côté client), juste l'accusé d'envoi habituel (toast, voir useFriends). */
export function CheerPicker({ onSend }: CheerPickerProps) {
  const s = strings.friends.cheer
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleSend = (emoji: CheerEmoji) => {
    setOpen(false)
    onSend(emoji)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={s.sendLabel}
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
      >
        <HeartHandshake size={17} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="group"
          aria-label={s.pickerLabel}
          className="absolute right-0 top-full z-10 mt-1 flex gap-1 rounded-full border border-[var(--line)] bg-[var(--surface)] p-1.5 shadow-lg"
        >
          {CHEER_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => handleSend(emoji)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-base transition-colors duration-200 hover:bg-[var(--surface-2)]"
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
