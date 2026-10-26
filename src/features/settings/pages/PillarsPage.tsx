import { Archive, ArchiveRestore } from 'lucide-react'
import type { FormEvent } from 'react'
import { useRef, useState } from 'react'

import { GalaxyView } from '@/features/galaxy/components/GalaxyView'
import { PillarGoal } from '@/features/pillars/components/PillarGoal'
import { levelProgressForXp } from '@/features/pillars/pillar-xp'
import { PILLAR_COLORS } from '@/features/pillars/pillar-colors'
import { MAX_ACTIVE_PILLARS, usePillars } from '@/features/pillars/usePillars'
import type { PillarRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

import { BalanceCard } from './stats/BalanceCard'

function PillarRow({
  pillar,
  onRename,
  onRecolor,
  onArchive,
  onUnarchive,
  onSetGoal,
  onClearGoal,
}: {
  pillar: PillarRecord
  onRename: (name: string) => void
  onRecolor: (color: string) => void
  onArchive: () => void
  onUnarchive: () => void
  onSetGoal: (level: number, deadlineMs: number | null) => void
  onClearGoal: () => void
}) {
  const s = strings.settings.pillars
  const [isEditingName, setIsEditingName] = useState(false)
  const [draftName, setDraftName] = useState(pillar.name)
  const [isPickingColor, setIsPickingColor] = useState(false)
  const { xpInLevel, xpForNextLevel } = levelProgressForXp(pillar.currentXp)
  const progressPct = Math.min(100, Math.round((xpInLevel / xpForNextLevel) * 100))

  const commitName = () => {
    setIsEditingName(false)
    const trimmed = draftName.trim()
    if (trimmed && trimmed !== pillar.name) onRename(trimmed)
    else setDraftName(pillar.name)
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={s.colorLabel}
          aria-expanded={isPickingColor}
          onClick={() => setIsPickingColor((prev) => !prev)}
          className="h-6 w-6 shrink-0 rounded-full ring-1 ring-[var(--panel-line)] transition-transform duration-150 hover:scale-110"
          style={{ backgroundColor: pillar.color }}
        />

        {isEditingName ? (
          <input
            autoFocus
            aria-label={s.nameLabel}
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
              if (event.key === 'Escape') {
                setDraftName(pillar.name)
                setIsEditingName(false)
              }
            }}
            className="h-8 flex-1 rounded-lg border border-[var(--panel-line)] bg-transparent px-2 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditingName(true)}
            className="flex-1 truncate text-left text-sm font-medium text-[var(--panel-text)]"
          >
            {pillar.name}
          </button>
        )}

        <span className="shrink-0 text-xs text-[var(--panel-muted)]">
          {s.level} {pillar.level}
        </span>

        <button
          type="button"
          aria-label={pillar.archivedAt ? s.unarchive : s.archive}
          onClick={pillar.archivedAt ? onUnarchive : onArchive}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--panel-muted)] transition-colors duration-200 hover:bg-[var(--panel-line)] hover:text-[var(--panel-text)]"
        >
          {pillar.archivedAt ? (
            <ArchiveRestore size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Archive size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>

      {isPickingColor ? (
        <div className="flex flex-wrap gap-1.5 pl-9">
          {PILLAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={color}
              aria-pressed={pillar.color === color}
              onClick={() => {
                onRecolor(color)
                setIsPickingColor(false)
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                background: color,
                outline: pillar.color === color ? '2px solid var(--panel-text)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      ) : null}

      {!pillar.archivedAt ? (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--panel-line)]">
            <div
              className="h-full rounded-full transition-[width] duration-300"
              style={{ width: `${progressPct}%`, backgroundColor: pillar.color }}
            />
          </div>
          <PillarGoal pillar={pillar} onSetGoal={onSetGoal} onClearGoal={onClearGoal} />
        </>
      ) : null}
    </div>
  )
}

export function PillarsPage() {
  const s = strings.settings.pillars
  const {
    pillars,
    activePillars,
    addPillar,
    renamePillar,
    recolorPillar,
    archivePillar,
    unarchivePillar,
    setGoal,
    clearGoal,
  } = usePillars()
  const [draftName, setDraftName] = useState('')
  const colorRef = useRef(0)

  const archivedPillars = pillars.filter((pillar) => pillar.archivedAt !== null)
  const canAddMore = activePillars.length < MAX_ACTIVE_PILLARS

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = draftName.trim()
    if (!trimmed || !canAddMore) return
    const color = PILLAR_COLORS[colorRef.current % PILLAR_COLORS.length]
    colorRef.current += 1
    void addPillar(trimmed, color)
    setDraftName('')
  }

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>
      <p className="max-w-md text-sm text-[var(--panel-muted)]">{s.hint}</p>

      <div className="flex max-w-md flex-col gap-2">
        {activePillars.length === 0 ? (
          <p className="text-sm text-[var(--panel-muted)]">{s.empty}</p>
        ) : (
          activePillars.map((pillar) => (
            <PillarRow
              key={pillar.id}
              pillar={pillar}
              onRename={(name) => void renamePillar(pillar.id, name)}
              onRecolor={(color) => void recolorPillar(pillar.id, color)}
              onArchive={() => void archivePillar(pillar.id)}
              onUnarchive={() => void unarchivePillar(pillar.id)}
              onSetGoal={(level, deadline) => void setGoal(pillar.id, level, deadline)}
              onClearGoal={() => void clearGoal(pillar.id)}
            />
          ))
        )}
      </div>

      {canAddMore ? (
        <form onSubmit={handleAdd} className="flex max-w-md gap-2">
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder={s.addPlaceholder}
            className="h-10 flex-1 rounded-xl border border-[var(--panel-line)] bg-transparent px-3 text-sm text-[var(--panel-text)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={!draftName.trim()}
            className="h-10 shrink-0 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] transition-opacity duration-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {s.addButton}
          </button>
        </form>
      ) : (
        <p className="max-w-md text-xs text-[var(--panel-muted)]">{s.maxReached}</p>
      )}

      {archivedPillars.length > 0 ? (
        <div className="flex max-w-md flex-col gap-2">
          <p className="text-sm font-medium text-[var(--panel-muted)]">{s.archivedSection}</p>
          <p className="text-xs text-[var(--panel-muted)]">{s.archivedHint}</p>
          {archivedPillars.map((pillar) => (
            <PillarRow
              key={pillar.id}
              pillar={pillar}
              onRename={(name) => void renamePillar(pillar.id, name)}
              onRecolor={(color) => void recolorPillar(pillar.id, color)}
              onArchive={() => void archivePillar(pillar.id)}
              onUnarchive={() => void unarchivePillar(pillar.id)}
              onSetGoal={(level, deadline) => void setGoal(pillar.id, level, deadline)}
              onClearGoal={() => void clearGoal(pillar.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Radar et galaxie (lot 4, §2) : déplacés de l'onglet Statistiques général vers la
          section Piliers, sous le radar — les deux visualisations concernent les piliers
          spécifiquement, pas les statistiques générales (tâches/temps de focus). */}
      <BalanceCard activePillars={activePillars} />

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--panel-muted)]">{s.galaxyTitle}</p>
        <GalaxyView />
      </div>
    </div>
  )
}
