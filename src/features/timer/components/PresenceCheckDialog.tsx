import { BellRing } from 'lucide-react'
import { useEffect, useRef } from 'react'

import { GlassCard, ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

interface PresenceCheckDialogProps {
  /** `frozen` : Chrono / Minuteur figé ; `pomodoro` : le focus suivant attend. */
  kind: 'frozen' | 'pomodoro'
  /** Le navigateur a bloqué le son : on le dit, la fenêtre est le repli visuel. */
  soundBlocked: boolean
  onConfirm: () => void
  onEnd: () => void
}

/**
 * « Tu es toujours là ? » (garde anti-oubli de 4 h). Fenêtre bloquante : ni Échap ni clic sur le
 * fond ne la ferment — seule une réponse relance le temps, sans quoi la session reste figée à la
 * dernière limite confirmée. Le focus reste piégé entre ses deux boutons.
 */
export function PresenceCheckDialog({
  kind,
  soundBlocked,
  onConfirm,
  onEnd,
}: PresenceCheckDialogProps) {
  const s = strings.focus.presence
  const confirmRef = useRef<HTMLButtonElement>(null)
  const endRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
  }, [])

  const keepFocusInside = (event: React.KeyboardEvent) => {
    if (event.key !== 'Tab') return
    const first = confirmRef.current
    const last = endRef.current
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <ModalOverlay className="z-[80]">
      <GlassCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="presence-title"
        aria-describedby="presence-body"
        onKeyDown={keepFocusInside}
        className="relative flex w-full max-w-sm flex-col items-center gap-4 rounded-3xl p-7 text-center"
      >
        <BellRing
          size={28}
          strokeWidth={1.75}
          aria-hidden="true"
          className="text-[var(--accent)]"
        />
        <h2 id="presence-title" className="font-brand text-xl" style={{ color: 'var(--text)' }}>
          {s.title}
        </h2>
        <p id="presence-body" className="text-sm" style={{ color: 'var(--muted)' }}>
          {kind === 'pomodoro' ? s.bodyPomodoro : s.body}
        </p>
        {soundBlocked ? (
          <p role="status" className="text-xs" style={{ color: 'var(--muted)' }}>
            {s.soundBlocked}
          </p>
        ) : null}
        <button
          ref={confirmRef}
          type="button"
          onClick={onConfirm}
          className="h-11 w-full rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 hover:opacity-90"
        >
          {s.confirm}
        </button>
        <button
          ref={endRef}
          type="button"
          onClick={onEnd}
          className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
        >
          {s.end}
        </button>
      </GlassCard>
    </ModalOverlay>
  )
}
