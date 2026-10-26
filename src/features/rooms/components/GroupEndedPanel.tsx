import { strings } from '@/shared/i18n'

interface GroupEndedPanelProps {
  onClose: () => void
}

/** Écran de fin d'une session de groupe : les minutes ont déjà été enregistrées par le
 * serveur ; reste à fermer l'écran pour retrouver le minuteur personnel. */
export function GroupEndedPanel({ onClose }: GroupEndedPanelProps) {
  const s = strings.rooms.group
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-2xl font-semibold text-[var(--text)]">{s.ended}</p>
      <p className="max-w-xs text-sm text-[var(--muted)]">{s.endedHint}</p>
      <button
        type="button"
        onClick={onClose}
        className="h-11 rounded-xl bg-[var(--accent)] px-6 text-sm font-medium text-[var(--on-accent)]"
      >
        {s.close}
      </button>
    </div>
  )
}
