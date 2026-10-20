import { Check, Loader2, X } from 'lucide-react'
import type { ReactNode } from 'react'

interface CheckRowProps {
  label: string
  status: 'ok' | 'error' | 'pending'
  statusLabel: string
  detail?: ReactNode
}

/**
 * Le statut n'est jamais porté par la seule couleur : `statusLabel` (texte) accompagne
 * toujours l'icône, lue par les lecteurs d'écran comme par l'œil.
 */
export function CheckRow({ label, status, statusLabel, detail }: CheckRowProps) {
  return (
    <li className="flex flex-col gap-0.5 rounded-xl border border-[var(--line)] px-3.5 py-2.5">
      <div className="flex items-center gap-2.5">
        {status === 'pending' ? (
          <Loader2 size={16} strokeWidth={2} className="shrink-0 animate-spin text-[var(--muted)]" aria-hidden="true" />
        ) : status === 'ok' ? (
          <Check size={16} strokeWidth={2.5} className="shrink-0 text-[#2E9E5B]" aria-hidden="true" />
        ) : (
          <X size={16} strokeWidth={2.5} className="shrink-0 text-[#E5484D]" aria-hidden="true" />
        )}
        <span className="text-sm text-[var(--text)]">{label}</span>
        <span
          className={`ml-auto shrink-0 text-xs font-medium ${
            status === 'ok'
              ? 'text-[#2E9E5B]'
              : status === 'error'
                ? 'text-[#E5484D]'
                : 'text-[var(--muted)]'
          }`}
        >
          {statusLabel}
        </span>
      </div>
      {detail ? <p className="pl-[26px] text-xs text-[var(--muted)]">{detail}</p> : null}
    </li>
  )
}
