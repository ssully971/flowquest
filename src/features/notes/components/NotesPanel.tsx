import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { strings } from '@/shared/i18n'

import { useNote } from '../useNote'

interface NotesPanelProps {
  open: boolean
  onClose: () => void
}

export function NotesPanel({ open, onClose }: NotesPanelProps) {
  const { content, setContent, isSaving } = useNote()
  const panelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    textareaRef.current?.focus()

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const wordCount = content.trim().length === 0 ? 0 : content.trim().split(/\s+/).length
  const charCount = content.length

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={strings.notes.title}
      className="absolute bottom-full right-0 z-40 mb-3 flex h-[min(24rem,60vh)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_24px_var(--glow)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{strings.notes.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.notes.close}
          className="rounded-full p-1 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={strings.notes.placeholder}
        className="flex-1 resize-none rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
      />

      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {wordCount} {strings.notes.words} · {charCount} {strings.notes.characters}
        </span>
        <span>{isSaving ? strings.notes.saving : strings.notes.saved}</span>
      </div>
    </div>
  )
}
