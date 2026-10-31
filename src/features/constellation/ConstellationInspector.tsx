import { ArrowLeft, ArrowRight, Check, Minus, Plus, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'

import { tierForLevel } from '@/features/pillars/pillar-tiers'
import { strings } from '@/shared/i18n'
import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

import type { ConstellationPeriod, GraphNode } from './build-graph'
import { formatShort } from './format'
import { linkRows, pillarSummary, taskFocusStats, unlockState, weeklyFocus } from './inspector-data'
import type { LinkRowKind } from './inspector-data'

interface ConstellationInspectorProps {
  node: GraphNode
  tasks: TaskRecord[]
  pillars: PillarRecord[]
  sessions: FocusSessionRecord[]
  links: TaskLinkRecord[]
  period: ConstellationPeriod
  now: number
  onClose: () => void
  onSelectNode: (id: string) => void
  /** Lance le mode « relier » depuis cette tâche. */
  onStartLink: (taskId: string) => void
  onRemoveLink: (linkId: string) => void
  onOpenTask: (taskId: string) => void
  onMarkDone: (taskId: string) => void
  onStartFocus: (taskId: string) => void
  onExpandGroup: (pillarKey: string) => void
  /** Pilier : passer en vue locale centrée sur lui. */
  onViewLocal?: (nodeId: string) => void
}

const LINK_ICONS: Record<LinkRowKind, typeof ArrowLeft> = {
  dependsOn: ArrowLeft,
  unlocks: ArrowRight,
  related: Minus,
}

const sectionTitle =
  'text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[var(--cst-label)]'
const secondaryButton =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] border border-[var(--cst-chrome-line)] px-3 text-sm text-[var(--text)] transition-colors hover:bg-[var(--cst-chrome-line)]'
const primaryButton =
  'inline-flex min-h-11 flex-1 items-center justify-center rounded-[10px] bg-[var(--accent)] px-3 text-sm font-semibold text-[var(--on-accent)] transition-opacity hover:opacity-90'

/**
 * Inspecteur d'un nœud (lot 3) : à droite sur grand écran (le graphe se réduit), feuille en bas
 * sur téléphone et tablette portrait. Tâche : pilier, titre, statut, encart de déblocage, temps et
 * sessions, focus par semaine, liens (cliquables) et actions. Pilier / groupe : version courte.
 */
export function ConstellationInspector(props: ConstellationInspectorProps) {
  const { node, tasks, pillars, sessions, links, period, now } = props
  const s = strings.constellation.inspector
  const task =
    node.kind === 'task' ? tasks.find((candidate) => candidate.id === node.id) : undefined
  const pillar = pillars.find((candidate) => candidate.id === node.pillarId)

  const stats = useMemo(
    () => (task ? taskFocusStats(task.id, tasks, sessions, period, now) : null),
    [task, tasks, sessions, period, now],
  )
  const weeks = useMemo(
    () => (task ? weeklyFocus(task.id, tasks, sessions, period, now) : []),
    [task, tasks, sessions, period, now],
  )
  const rows = useMemo(
    () => (task ? linkRows(task.id, links, tasks, pillars) : []),
    [task, links, tasks, pillars],
  )
  const unlock = useMemo(
    () => (task ? unlockState(task, links, tasks) : null),
    [task, links, tasks],
  )
  const summary = useMemo(
    () =>
      node.kind === 'pillar' ? pillarSummary(node.pillarId, tasks, sessions, period, now) : null,
    [node, tasks, sessions, period, now],
  )
  const maxWeek = Math.max(0, ...weeks.map((week) => week.seconds))
  const pillarLabel = pillar?.name ?? strings.constellation.filters.noPillar
  const pillarColor = pillar?.color ?? '#8A93A6'

  return (
    <aside
      aria-label={node.label}
      data-testid="constellation-inspector"
      className="absolute inset-x-0 bottom-0 z-20 flex h-[55%] flex-col rounded-t-2xl border-t border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] backdrop-blur-xl lg:static lg:h-auto lg:w-80 lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0"
    >
      <button
        type="button"
        onClick={props.onClose}
        aria-label={s.handle}
        className="flex h-6 w-full shrink-0 items-center justify-center lg:hidden"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-[var(--cst-chrome-line)]" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 px-5 pt-3 lg:pt-5">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: pillarColor }}
          />
          <span className="min-w-0 flex-1 truncate text-xs text-[var(--cst-label)]">
            {node.kind === 'pillar'
              ? s.pillarTier(
                  strings.pillars.tiers[tierForLevel(node.level ?? 1).id],
                  node.level ?? 1,
                )
              : pillarLabel}
          </span>
          <button
            type="button"
            onClick={props.onClose}
            aria-label={s.deselect}
            className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--cst-label)] hover:text-[var(--text)]"
          >
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        <h3
          className="px-5 text-[1.375rem] font-semibold leading-snug"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {node.label}
        </h3>

        {task ? (
          <div className="flex flex-col gap-3 px-5 pb-4 pt-3">
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs ${
                task.done
                  ? 'bg-[var(--cst-ok-soft)] text-[var(--cst-ok)]'
                  : 'bg-[var(--cst-chrome-line)] text-[var(--text)]'
              }`}
            >
              {task.done ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : null}
              {task.archivedAt ? `${s.archived} · ` : ''}
              {task.done && task.doneAt
                ? s.doneOn(
                    new Date(task.doneAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    }),
                  )
                : task.done
                  ? strings.constellation.detail.done
                  : s.todo}
            </span>

            {unlock?.kind === 'unlocked' ? (
              <p
                data-testid="constellation-unlock"
                className="rounded-xl bg-[var(--cst-ok-soft)] px-3 py-2 text-sm text-[var(--cst-ok)]"
              >
                {s.unlockedPrefix}{' '}
                {unlock.doneTitles.length === 1 ? (
                  <>
                    <strong className="font-semibold">{unlock.doneTitles[0]}</strong>{' '}
                    {s.unlockedOne}
                  </>
                ) : (
                  s.unlockedMany
                )}
              </p>
            ) : unlock?.kind === 'blocked' ? (
              <p
                data-testid="constellation-unlock"
                className="rounded-xl bg-[var(--cst-chrome-line)] px-3 py-2 text-sm text-[var(--text)]"
              >
                {s.blockedBy(unlock.blockingTitles.join(', '))}
              </p>
            ) : null}
          </div>
        ) : null}

        {task && stats ? (
          <div className="border-t border-[var(--cst-chrome-line)] px-5 py-4">
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-[var(--cst-label)]">{s.focusTime}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatShort(stats.focusSeconds)}
                </p>
              </div>
              <div>
                <p className="text-xs text-[var(--cst-label)]">{s.sessions}</p>
                <p className="text-lg font-semibold tabular-nums">{stats.sessions}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-[var(--cst-label)]">{s.weekly}</p>
            <div
              role="img"
              aria-label={s.weeklyLabel(weeks.length, formatShort(maxWeek))}
              className="mt-2 flex h-14 items-end gap-1"
            >
              {weeks.map((week) => (
                <span
                  key={week.weekStart}
                  data-testid="constellation-week-bar"
                  data-empty={week.seconds === 0}
                  className="min-w-[3px] flex-1 rounded-[3px]"
                  style={{
                    height:
                      week.seconds === 0 ? 1 : `${Math.max(8, (week.seconds / maxWeek) * 100)}%`,
                    background: week.seconds === 0 ? 'var(--cst-chrome-line)' : pillarColor,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}

        {task ? (
          <div className="border-t border-[var(--cst-chrome-line)] px-5 py-4">
            <p className={`${sectionTitle} mb-2`}>{s.links}</p>
            {rows.length === 0 ? (
              <p className="mb-2 text-sm text-[var(--cst-label)]">{s.noLinks}</p>
            ) : (
              <ul className="mb-2 flex flex-col gap-2">
                {rows.map((row) => {
                  const Icon = LINK_ICONS[row.kind]
                  return (
                    <li key={row.linkId} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => props.onSelectNode(row.otherTaskId)}
                        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl bg-[var(--cst-chrome-line)] px-3 text-left"
                      >
                        <Icon
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden="true"
                          className="shrink-0 text-[var(--cst-highlight)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[0.6875rem] text-[var(--cst-label)]">
                            {s.linkKinds[row.kind]}
                          </span>
                          <span className="block truncate text-sm">{row.otherTitle}</span>
                        </span>
                        {row.otherPillar ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--cst-label)]">
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: row.otherPillar.color }}
                            />
                            {row.otherPillar.name}
                          </span>
                        ) : null}
                        <span
                          className={`shrink-0 text-xs ${row.otherDone ? 'text-[var(--cst-ok)]' : 'text-[var(--cst-label)]'}`}
                        >
                          {row.otherDone ? s.statusDone : s.statusTodo}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => props.onRemoveLink(row.linkId)}
                        aria-label={`${strings.constellation.detail.removeLink} : ${row.otherTitle}`}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--cst-label)] hover:text-[var(--text)]"
                      >
                        <Trash2 size={15} strokeWidth={1.75} aria-hidden="true" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              type="button"
              onClick={() => props.onStartLink(node.id)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--cst-edge-user)] text-sm text-[var(--cst-label)] transition-colors hover:text-[var(--text)]"
            >
              <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
              {s.linkTo}
            </button>
          </div>
        ) : null}

        {node.kind === 'pillar' && summary ? (
          <div className="flex flex-col gap-3 border-t border-[var(--cst-chrome-line)] px-5 py-4">
            <div className="flex gap-8">
              <div>
                <p className="text-xs text-[var(--cst-label)]">{s.focusTime}</p>
                <p className="text-lg font-semibold tabular-nums">{formatShort(summary.seconds)}</p>
              </div>
            </div>
            <p className="text-sm tabular-nums">
              {s.pillarTasks(summary.tasksDone, summary.tasksTotal)}
            </p>
            {props.onViewLocal ? (
              <button
                type="button"
                onClick={() => props.onViewLocal?.(node.id)}
                className={secondaryButton}
              >
                {s.viewLocal}
              </button>
            ) : null}
          </div>
        ) : null}

        {node.kind === 'group' ? (
          <div className="flex flex-col gap-3 border-t border-[var(--cst-chrome-line)] px-5 py-4">
            <p className="text-sm">{strings.constellation.detail.groupOf(node.groupCount ?? 0)}</p>
            <p className="text-sm tabular-nums">
              {s.focusTime} : {formatShort(node.seconds)}
            </p>
            <button
              type="button"
              onClick={() => props.onExpandGroup(node.pillarId ?? '__none__')}
              className={secondaryButton}
            >
              {strings.constellation.detail.expandGroup}
            </button>
          </div>
        ) : null}
      </div>

      {task ? (
        <div className="flex shrink-0 gap-2 border-t border-[var(--cst-chrome-line)] px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {task.done ? (
            <button
              type="button"
              onClick={() => props.onOpenTask(task.id)}
              className={secondaryButton}
            >
              {s.openTask}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => props.onMarkDone(task.id)}
              className={secondaryButton}
            >
              {s.markDone}
            </button>
          )}
          <button
            type="button"
            onClick={() => props.onStartFocus(task.id)}
            className={primaryButton}
          >
            {s.startFocus}
          </button>
        </div>
      ) : null}
    </aside>
  )
}
