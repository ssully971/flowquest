import { X } from 'lucide-react'
import { useEffect } from 'react'

import { GlassCard, ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

/** Petite fenêtre d'aide listant les raccourcis clavier (LOT G1) : ouverte par la touche
 * « ? » ou par le lien dédié dans Réglages > Minuteur — jamais de bouton permanent à
 * l'écran pour l'atteindre. */
export function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  const s = strings.focus.shortcuts

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const rows: { key: string; label: string }[] = [
    { key: s.keys.primary, label: s.items.primary },
    { key: s.keys.next, label: s.items.next },
    { key: s.keys.reset, label: s.items.reset },
    { key: s.keys.mute, label: s.items.mute },
    { key: s.keys.help, label: s.items.help },
  ]

  return (
    <ModalOverlay className="z-50" blur onBackdropClick={onClose}>
      <GlassCard
        role="dialog"
        aria-label={s.title}
        className="relative z-10 flex w-full max-w-sm flex-col gap-4 rounded-[28px] p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">{s.title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.closeLabel}
            className="-m-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <X size={15} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <ul className="flex flex-col gap-2.5">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--text)]">{row.label}</span>
              <kbd className="shrink-0 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-2 py-1 font-mono text-xs font-medium text-[var(--muted)]">
                {row.key}
              </kbd>
            </li>
          ))}
        </ul>
      </GlassCard>
    </ModalOverlay>
  )
}
