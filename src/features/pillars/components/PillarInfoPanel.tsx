import { Info, X } from 'lucide-react'
import { useEffect } from 'react'

import { ModalOverlay } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { PILLAR_TIERS, tierForLevel } from '../pillar-tiers'
import { hoursToReachLevel } from '../pillar-xp'
import { PillarTierBadge } from './PillarTierBadge'

/** Niveaux montrés dans la table : les débuts, puis chaque seuil de palier. */
const TABLE_LEVELS = [2, 3, 4, 5, 8, 10, 12, 18, 25]

interface PillarInfoPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * Explication concrète des piliers (lot 6A) : ce qu'est un pilier, comment on gagne de l'XP,
 * table niveau ↔ heures cumulées, ce que débloque un niveau, comment lier une session. Les
 * heures viennent de hoursToReachLevel (même formule que le serveur, migration 0034).
 */
export function PillarInfoPanel({ open, onClose }: PillarInfoPanelProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const s = strings.pillars.info

  return (
    <ModalOverlay className="z-[70]" blur onBackdropClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={s.title}
        className="relative z-10 my-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface)] p-5 text-[var(--panel-text)] shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {s.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={s.close}
            className="-m-2 flex h-11 w-11 items-center justify-center rounded-full text-[var(--panel-muted)] hover:text-[var(--panel-text)]"
          >
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <section>
          <h3 className="mb-1 text-sm font-semibold">{s.whatTitle}</h3>
          <p className="text-sm text-[var(--panel-muted)]">{s.whatText}</p>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">{s.xpTitle}</h3>
          <p className="text-sm text-[var(--panel-muted)]">{s.xpText}</p>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">{s.tableTitle}</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--panel-muted)]">
              <tr>
                <th className="py-1 font-medium">{s.tableLevel}</th>
                <th className="py-1 font-medium">{s.tableHours}</th>
                <th className="py-1 font-medium">{s.tableTitleCol}</th>
              </tr>
            </thead>
            <tbody>
              {TABLE_LEVELS.map((level) => {
                const isTierStart = PILLAR_TIERS.some((tier) => tier.minLevel === level)
                return (
                  <tr key={level} className="border-t border-[var(--panel-line)]">
                    <td className="py-1.5">{level}</td>
                    <td className="py-1.5">
                      {hoursToReachLevel(level)} {s.hoursUnit}
                    </td>
                    <td className="py-1.5">
                      {isTierStart ? (
                        <PillarTierBadge level={tierForLevel(level).minLevel} tone="panel" />
                      ) : (
                        <span className="text-[var(--panel-muted)]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-1.5 text-xs text-[var(--panel-muted)]">{s.tableNote}</p>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">{s.unlocksTitle}</h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-[var(--panel-muted)]">
            {s.unlocks.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-semibold">{s.linkTitle}</h3>
          <p className="text-sm text-[var(--panel-muted)]">{s.linkText}</p>
        </section>
      </div>
    </ModalOverlay>
  )
}

/** Bouton « i » qui ouvre le panneau (sélecteur de pilier, page Piliers). */
export function PillarInfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={strings.pillars.info.button}
      title={strings.pillars.info.button}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
    >
      <Info size={16} strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}
