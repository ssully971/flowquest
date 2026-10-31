import { Link2, Lock, LocateFixed, Minus, Plus, Trash2, Unlock, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { usePillars } from '@/features/pillars/usePillars'
import { tierForLevel } from '@/features/pillars/pillar-tiers'
import { formatFocusDuration } from '@/features/stats/format'
import { onSessionRecorded } from '@/features/stats/session-events'
import { useTasks } from '@/features/tasks/useTasks'
import { strings } from '@/shared/i18n'
import { getDb } from '@/shared/storage/db'
import type { FocusSessionRecord } from '@/shared/storage/db'
import { useToast } from '@/shared/toast'

import { buildGraph, NO_PILLAR_NODE_ID } from './build-graph'
import type { ConstellationFilters, GraphNode } from './build-graph'
import { ConstellationCanvas } from './ConstellationCanvas'
import type { ConstellationCanvasHandle } from './ConstellationCanvas'
import type { TaskLinkKind } from './link-rules'
import { useConstellationLayout } from './useConstellationLayout'
import { useTaskLinks } from './useTaskLinks'

const LOCK_KEY = 'flowquest.constellationLocked'

function readLocked(): boolean {
  try {
    return window.localStorage.getItem(LOCK_KEY) === '1'
  } catch {
    return false
  }
}

const NODE_LABELS = {
  noPillar: strings.constellation.filters.noPillar,
  group: (n: number) => `+${n}`,
}

function useAllFocusSessions(): FocusSessionRecord[] {
  const [sessions, setSessions] = useState<FocusSessionRecord[]>([])
  useEffect(() => {
    let cancelled = false
    const load = () =>
      void getDb()
        .then((db) => db.getAll('focusSessions'))
        .then((all) => {
          if (!cancelled) setSessions(all)
        })
    load()
    const unsubscribe = onSessionRecorded(load)
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])
  return sessions
}

const iconButton =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface-2)] disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-[var(--surface-2)] aria-pressed:ring-2 aria-pressed:ring-[var(--text)]'

/**
 * Page plein écran de la constellation : vue graphe façon Obsidian des tâches (nœuds) et des
 * piliers (centres). Filtres pilier/période, détail d'un nœud, cadenas de la vue, mode « relier ».
 */
export function ConstellationPage({ onClose }: { onClose: () => void }) {
  const s = strings.constellation
  const { showToast } = useToast()
  const { tasks, archivedTasks } = useTasks()
  const { pillars } = usePillars()
  const sessions = useAllFocusSessions()
  const { links, addLink, removeLink, restoreLink } = useTaskLinks()
  const canvasRef = useRef<ConstellationCanvasHandle>(null)

  const [filters, setFilters] = useState<ConstellationFilters>({
    pillar: 'all',
    period: '90d',
    showArchived: false,
  })
  const [locked, setLocked] = useState(readLocked)
  const [linkMode, setLinkMode] = useState(false)
  const [linkKind, setLinkKind] = useState<TaskLinkKind>('related')
  const [picked, setPicked] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [now] = useState(() => Date.now())

  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks])
  const graph = useMemo(
    () =>
      buildGraph({
        tasks: allTasks,
        pillars,
        sessions,
        links,
        filters,
        now,
        expandedGroups: expanded,
        labels: NODE_LABELS,
      }),
    [allTasks, pillars, sessions, links, filters, now, expanded],
  )
  const { positions, onPositionsChange } = useConstellationLayout(graph)

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph])
  const taskTitle = useCallback(
    (id: string) => allTasks.find((task) => task.id === id)?.title ?? '',
    [allTasks],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const toggleLocked = () => {
    const next = !locked
    setLocked(next)
    if (next) {
      setLinkMode(false)
      setPicked(null)
    }
    try {
      window.localStorage.setItem(LOCK_KEY, next ? '1' : '0')
    } catch {
      // Stockage indisponible : le verrou vaut pour cette visite seulement.
    }
  }

  const createLink = useCallback(
    async (fromId: string, toId: string) => {
      const from = nodeById.get(fromId)
      const to = nodeById.get(toId)
      if (from?.kind !== 'task' || to?.kind !== 'task') {
        showToast({ type: 'info', message: s.feedback.onlyTasks })
        return
      }
      const rejection = await addLink(fromId, toId, linkKind)
      showToast({
        type: 'info',
        message: rejection ? s.feedback.rejections[rejection] : s.feedback.linkCreated,
      })
    },
    [addLink, linkKind, nodeById, s.feedback, showToast],
  )

  const handleSelectNode = (id: string | null) => {
    setSelectedEdgeId(null)
    if (linkMode && id) {
      // Sélection à deux touches : première tâche, puis seconde.
      if (!picked) {
        if (nodeById.get(id)?.kind !== 'task') {
          showToast({ type: 'info', message: s.feedback.onlyTasks })
          return
        }
        setPicked(id)
      } else {
        const first = picked
        setPicked(null)
        void createLink(first, id)
      }
      return
    }
    setSelectedId(id)
  }

  const handleRemoveLink = (linkId: string) => {
    const link = links.find((candidate) => candidate.id === linkId)
    void removeLink(linkId)
    setSelectedEdgeId(null)
    showToast({
      type: 'info',
      message: s.feedback.linkRemoved,
      action: link ? { label: s.feedback.undo, onClick: () => void restoreLink(link) } : undefined,
    })
  }

  const selectedNode: GraphNode | null = selectedId ? (nodeById.get(selectedId) ?? null) : null
  const selectedEdge = selectedEdgeId
    ? graph.edges.find((edge) => edge.id === selectedEdgeId)
    : null
  const highlighted = useMemo<ReadonlySet<string>>(() => {
    const ids = new Set<string>()
    if (selectedId) ids.add(selectedId)
    if (picked) ids.add(picked)
    return ids
  }, [selectedId, picked])

  const linksOfSelected =
    selectedNode?.kind === 'task'
      ? links.filter(
          (link) => link.fromTaskId === selectedNode.id || link.toTaskId === selectedNode.id,
        )
      : []

  const topPillarSeconds = Object.entries(graph.stats.secondsByPillar)
    .filter(([, seconds]) => seconds > 0)
    .sort((a, b) => b[1] - a[1])
  const pillarName = (key: string) =>
    key === NO_PILLAR_NODE_ID
      ? s.filters.noPillar
      : (pillars.find((pillar) => pillar.id === key)?.name ?? '')
  const hasTasks = graph.nodes.some((node) => node.kind === 'task' || node.kind === 'group')

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      data-testid="constellation-page"
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg)] text-[var(--text)]"
    >
      <header className="flex flex-wrap items-center gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h2 className="mr-auto text-lg font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {s.title}
        </h2>
        <button type="button" onClick={onClose} aria-label={s.close} className={iconButton}>
          <X size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-1 text-xs text-[var(--muted)]">
        <span>{s.stats.tasksDone(graph.stats.tasksDone, graph.stats.tasksTotal)}</span>
        <span>
          {s.stats.focusTime} : {formatFocusDuration(graph.stats.totalSeconds)}
        </span>
        {topPillarSeconds.slice(0, 4).map(([key, seconds]) => (
          <span key={key}>
            {pillarName(key)} · {formatFocusDuration(seconds)}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 py-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          {s.filters.pillar}
          <select
            value={filters.pillar}
            onChange={(event) => setFilters({ ...filters, pillar: event.target.value })}
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
          >
            <option value="all">{s.filters.allPillars}</option>
            {pillars
              .filter((pillar) => !pillar.archivedAt)
              .map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.name}
                </option>
              ))}
            <option value="none">{s.filters.noPillar}</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          {s.filters.period}
          <select
            value={filters.period}
            onChange={(event) =>
              setFilters({
                ...filters,
                period: event.target.value as ConstellationFilters['period'],
              })
            }
            className="h-11 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-2 text-sm text-[var(--text)]"
          >
            <option value="30d">{s.filters.periods['30d']}</option>
            <option value="90d">{s.filters.periods['90d']}</option>
            <option value="all">{s.filters.periods.all}</option>
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-2 text-xs text-[var(--muted)]">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(event) => setFilters({ ...filters, showArchived: event.target.checked })}
            className="h-5 w-5"
          />
          {s.filters.showArchived}
        </label>
      </div>

      <div className="relative min-h-0 flex-1">
        {positions ? (
          <ConstellationCanvas
            ref={canvasRef}
            graph={graph}
            positions={positions}
            locked={locked}
            linkMode={linkMode}
            selectedIds={highlighted}
            selectedEdgeId={selectedEdgeId}
            ariaLabel={s.canvasLabel(graph.nodes.length, links.length)}
            onSelectNode={handleSelectNode}
            onSelectEdge={(id) => {
              setSelectedEdgeId(id)
              setSelectedId(null)
            }}
            onLink={(from, to) => void createLink(from, to)}
            onPositionsChange={onPositionsChange}
          />
        ) : (
          <p className="p-4 text-sm text-[var(--muted)]">{s.loading}</p>
        )}

        {!hasTasks && positions ? (
          <p className="pointer-events-none absolute inset-x-6 top-6 text-center text-sm text-[var(--muted)]">
            {s.empty}
          </p>
        ) : null}

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={toggleLocked}
            aria-pressed={locked}
            aria-label={locked ? s.toolbar.unlock : s.toolbar.lock}
            title={locked ? s.toolbar.unlock : s.toolbar.lock}
            className={iconButton}
          >
            {locked ? (
              <Lock size={18} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Unlock size={18} strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => canvasRef.current?.recenter()}
            aria-label={s.toolbar.recenter}
            title={s.toolbar.recenter}
            className={iconButton}
          >
            <LocateFixed size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => canvasRef.current?.zoomBy(1.3)}
            disabled={locked}
            aria-label={s.toolbar.zoomIn}
            className={iconButton}
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => canvasRef.current?.zoomBy(1 / 1.3)}
            disabled={locked}
            aria-label={s.toolbar.zoomOut}
            className={iconButton}
          >
            <Minus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              setLinkMode((prev) => !prev)
              setPicked(null)
              setSelectedId(null)
            }}
            disabled={locked}
            aria-pressed={linkMode}
            aria-label={linkMode ? s.toolbar.linkModeOff : s.toolbar.linkMode}
            title={linkMode ? s.toolbar.linkModeOff : s.toolbar.linkMode}
            className={iconButton}
          >
            <Link2 size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>

        {locked ? (
          <p className="pointer-events-none absolute right-3 top-3 max-w-[12rem] rounded-xl bg-[var(--surface)] px-3 py-2 text-xs text-[var(--muted)]">
            {s.toolbar.lockedHint}
          </p>
        ) : null}

        {linkMode ? (
          <div className="absolute inset-x-3 top-3 ml-14 flex flex-col gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm">
            <div role="radiogroup" aria-label={s.toolbar.linkKind} className="flex gap-2">
              {(['related', 'depends_on'] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={linkKind === kind}
                  onClick={() => setLinkKind(kind)}
                  className={`min-h-11 rounded-xl border px-3 text-sm ${
                    linkKind === kind
                      ? 'border-[var(--text)] bg-[var(--surface-2)]'
                      : 'border-[var(--line)] text-[var(--muted)]'
                  }`}
                >
                  {kind === 'related' ? s.toolbar.related : s.toolbar.dependsOn}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--muted)]">
              {picked ? s.toolbar.pickSecond(taskTitle(picked)) : s.toolbar.linkHint}
            </p>
          </div>
        ) : null}

        {selectedEdge?.linkId ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
            <p className="min-w-0 flex-1 truncate text-sm">
              {taskTitle(selectedEdge.source)} {selectedEdge.kind === 'depends_on' ? '→' : '↔'}{' '}
              {taskTitle(selectedEdge.target)}
            </p>
            <button
              type="button"
              onClick={() => handleRemoveLink(selectedEdge.linkId!)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] px-3 text-sm"
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
              {s.detail.removeLink}
            </button>
          </div>
        ) : selectedNode ? (
          <section
            aria-label={selectedNode.label}
            className="absolute inset-x-3 bottom-3 flex max-h-[45%] flex-col gap-2 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
                style={{ background: selectedNode.color }}
              />
              <h3 className="min-w-0 flex-1 text-sm font-semibold">{selectedNode.label}</h3>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label={s.detail.close}
                className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--muted)]"
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-[var(--muted)]">
              {selectedNode.kind === 'task'
                ? `${selectedNode.archived ? `${s.detail.archived} · ` : ''}${
                    selectedNode.done ? s.detail.done : s.detail.todo
                  }`
                : selectedNode.kind === 'group'
                  ? s.detail.groupOf(selectedNode.groupCount ?? 0)
                  : selectedNode.level
                    ? `${s.detail.level} ${selectedNode.level} · ${strings.pillars.tiers[tierForLevel(selectedNode.level).id]}`
                    : ''}
            </p>
            <p className="text-sm">
              {s.detail.timeSpent} : {formatFocusDuration(selectedNode.seconds)}
            </p>
            {selectedNode.kind === 'group' && selectedNode.pillarId !== undefined ? (
              <button
                type="button"
                onClick={() =>
                  setExpanded(new Set([...expanded, selectedNode.pillarId ?? NO_PILLAR_NODE_ID]))
                }
                className="min-h-11 self-start rounded-xl border border-[var(--line)] px-3 text-sm"
              >
                {s.detail.expandGroup}
              </button>
            ) : null}
            {linksOfSelected.length > 0 ? (
              <div>
                <p className="mb-1 text-xs text-[var(--muted)]">{s.detail.linkedTasks}</p>
                <ul className="flex flex-col gap-1">
                  {linksOfSelected.map((link) => {
                    const otherId =
                      link.fromTaskId === selectedNode.id ? link.toTaskId : link.fromTaskId
                    const text =
                      link.kind === 'related'
                        ? s.detail.relatedTo(taskTitle(otherId))
                        : link.fromTaskId === selectedNode.id
                          ? s.detail.dependsOn(taskTitle(otherId))
                          : s.detail.requiredBy(taskTitle(otherId))
                    return (
                      <li key={link.id} className="flex items-center gap-2 text-sm">
                        <span className="min-w-0 flex-1 truncate">{text}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(link.id)}
                          aria-label={`${s.detail.removeLink} : ${text}`}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)]"
                        >
                          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  )
}
