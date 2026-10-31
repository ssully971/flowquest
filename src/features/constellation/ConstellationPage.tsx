import {
  Link2,
  Lock,
  LocateFixed,
  Minus,
  Plus,
  SlidersHorizontal,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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
import type { CanvasViewState, ConstellationCanvasHandle } from './ConstellationCanvas'
import {
  DEFAULT_CONSTELLATION_SETTINGS,
  hasSeenConstellationHint,
  markConstellationHintSeen,
  readConstellationSettings,
  writeConstellationSettings,
} from './constellation-settings'
import type { ConstellationSettings } from './constellation-settings'
import { ConstellationMinimap } from './ConstellationMinimap'
import { ConstellationSettingsPopover } from './ConstellationSettingsPopover'
import { applyDisplayFilters } from './display-filters'
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

/** Bouton rond du chrome (44 × 44) : verre discret, état pressé lisible sans couleur vive. */
const chromeButton =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] text-[var(--text)] backdrop-blur-md transition-colors duration-200 hover:bg-[var(--cst-chrome-line)] disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:bg-[var(--cst-chrome-line)] aria-pressed:ring-1 aria-pressed:ring-[var(--cst-highlight)] aria-expanded:bg-[var(--cst-chrome-line)]'

/** Même verre, pour les barres flottantes. */
const chromeBar =
  'rounded-[14px] border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] backdrop-blur-md'

/** « 8 h 45 », « 9 h », « 40 min » : durée courte pour les puces et les indicateurs. */
function formatShort(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${String(minutes).padStart(2, '0')}`
}

/**
 * Page plein cadre de la constellation (v2, « graphe sobre ») : le graphe occupe tout l'écran,
 * l'interface flotte par-dessus — titre, puces de piliers (légende + filtre) et période, réglages,
 * pilule de zoom, mini-carte. Détail d'un nœud, cadenas de la vue et mode « relier » conservés.
 */
export function ConstellationPage({ onClose }: { onClose: () => void }) {
  const s = strings.constellation
  const { showToast } = useToast()
  const { tasks, archivedTasks } = useTasks()
  const { pillars } = usePillars()
  const sessions = useAllFocusSessions()
  const { links, addLink, removeLink, restoreLink } = useTaskLinks()
  const canvasRef = useRef<ConstellationCanvasHandle>(null)

  const [settings, setSettings] = useState<ConstellationSettings>(readConstellationSettings)
  const [period, setPeriod] = useState<ConstellationFilters['period']>('90d')
  const [hiddenPillars, setHiddenPillars] = useState<ReadonlySet<string>>(new Set())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [locked, setLocked] = useState(readLocked)
  const [linkMode, setLinkMode] = useState(false)
  const [linkKind, setLinkKind] = useState<TaskLinkKind>('related')
  const [picked, setPicked] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [view, setView] = useState<CanvasViewState | null>(null)
  const [layoutKey, setLayoutKey] = useState(0)
  const [hintVisible, setHintVisible] = useState(() => !hasSeenConstellationHint())
  const [now] = useState(() => Date.now())

  const updateSettings = useCallback((next: ConstellationSettings) => {
    setSettings(next)
    writeConstellationSettings(next)
  }, [])

  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks])
  const filters = useMemo<ConstellationFilters>(
    () => ({ pillar: 'all', period, showArchived: settings.showArchived }),
    [period, settings.showArchived],
  )
  const fullGraph = useMemo(
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
  // Disposition calculée sur le graphe complet : masquer un pilier ne déplace rien.
  const { positions, onPositionsChange, reset } = useConstellationLayout(fullGraph)
  const graph = useMemo(
    () => applyDisplayFilters(fullGraph, { hiddenPillars, showTodo: settings.showTodo }),
    [fullGraph, hiddenPillars, settings.showTodo],
  )

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

  const dismissHint = useCallback(() => {
    if (!hintVisible) return
    setHintVisible(false)
    markConstellationHintSeen()
  }, [hintVisible])

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

  const togglePillar = (key: string) => {
    setHiddenPillars((previous) => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
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

  // Puces : un pilier actif par puce (légende + filtre), plus « sans pilier » s'il a des tâches.
  const taskCountByPillar = new Map<string, number>()
  for (const node of fullGraph.nodes) {
    if (node.kind === 'task' || node.kind === 'group') {
      const key = node.pillarId ?? NO_PILLAR_NODE_ID
      taskCountByPillar.set(key, (taskCountByPillar.get(key) ?? 0) + 1)
    }
  }
  const chips = [
    ...pillars
      .filter((pillar) => !pillar.archivedAt)
      .map((pillar) => ({ key: pillar.id, name: pillar.name, color: pillar.color })),
    ...(taskCountByPillar.has(NO_PILLAR_NODE_ID)
      ? [{ key: NO_PILLAR_NODE_ID, name: s.filters.noPillar, color: '#8A93A6' }]
      : []),
  ]
  const hasTasks = fullGraph.nodes.some((node) => node.kind === 'task' || node.kind === 'group')
  const zoomPercent = Math.round((view?.k ?? 1) * 100)

  // Rendue dans <body> : le panneau de réglages qui l'ouvre est transformé, ce qui
  // emprisonnerait un `position: fixed` dans sa propre boîte.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={s.title}
      data-testid="constellation-page"
      onPointerDownCapture={dismissHint}
      className="fixed inset-0 z-[60] overflow-hidden bg-[var(--cst-bg)] text-[var(--text)]"
    >
      <div className="absolute inset-0">
        {positions ? (
          <ConstellationCanvas
            ref={canvasRef}
            graph={graph}
            positions={positions}
            locked={locked}
            linkMode={linkMode}
            selectedIds={highlighted}
            selectedEdgeId={selectedEdgeId}
            labels={settings.labels}
            nodeScale={settings.nodeScale}
            showArrows={settings.showArrows}
            layoutKey={layoutKey}
            onViewChange={setView}
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
          <p className="p-4 pt-24 text-sm text-[var(--cst-label)]">{s.loading}</p>
        )}
      </div>

      {!hasTasks && positions ? (
        <p className="pointer-events-none absolute inset-x-6 top-28 text-center text-sm text-[var(--cst-label)]">
          {s.empty}
        </p>
      ) : null}

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start gap-x-3 gap-y-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:flex-nowrap">
        <div className="pointer-events-auto min-w-0 flex-1 sm:w-56 sm:flex-none">
          <h2
            className="text-xl font-semibold leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {s.title}
          </h2>
          <p className="text-xs tabular-nums text-[var(--cst-label)]">
            <strong className="font-semibold text-[var(--text)]">
              {fullGraph.stats.tasksDone}/{fullGraph.stats.tasksTotal}
            </strong>{' '}
            {s.header.doneSuffix} ·{' '}
            <strong className="font-semibold text-[var(--text)]">
              {formatShort(fullGraph.stats.totalSeconds)}
            </strong>{' '}
            {s.header.focusSuffix}
          </p>
        </div>

        <div className="pointer-events-none order-3 flex w-full min-w-0 justify-center sm:order-none sm:flex-1">
          <div
            role="group"
            aria-label={s.pillarBar.label}
            className={`${chromeBar} pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto p-1`}
          >
            {chips.map((chip) => {
              const hidden = hiddenPillars.has(chip.key)
              const empty = !taskCountByPillar.has(chip.key)
              const seconds = fullGraph.stats.secondsByPillar[chip.key] ?? 0
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={!hidden}
                  aria-label={s.pillarBar.toggle(chip.name, hidden)}
                  onClick={() => togglePillar(chip.key)}
                  className={`flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] px-3 text-sm transition-colors ${
                    hidden || empty ? 'opacity-50' : ''
                  } ${hidden ? '' : 'bg-[var(--cst-chrome-line)]'}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={
                      empty || hidden
                        ? { border: `1.5px solid ${chip.color}` }
                        : { background: chip.color }
                    }
                  />
                  <span className="whitespace-nowrap">{chip.name}</span>
                  {seconds > 0 ? (
                    <span className="whitespace-nowrap tabular-nums text-[var(--cst-label)]">
                      {formatShort(seconds)}
                    </span>
                  ) : null}
                </button>
              )
            })}
            <span
              aria-hidden="true"
              className="mx-1 h-5 w-px shrink-0 bg-[var(--cst-chrome-line)]"
            />
            <div role="group" aria-label={s.pillarBar.periodLabel} className="flex shrink-0 gap-1">
              {(['30d', '90d', 'all'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={period === value}
                  onClick={() => setPeriod(value)}
                  className={`min-h-11 rounded-[10px] px-3 text-sm tabular-nums transition-colors ${
                    period === value
                      ? 'bg-[var(--cst-chrome-line)] font-semibold text-[var(--text)]'
                      : 'text-[var(--cst-label)] hover:text-[var(--text)]'
                  }`}
                >
                  {s.pillarBar.periods[value]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex shrink-0 gap-2">
          <button
            type="button"
            data-settings-toggle
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
            aria-label={s.settings.open}
            title={s.settings.open}
            className={chromeButton}
          >
            <SlidersHorizontal size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label={s.close} className={chromeButton}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      </header>

      {settingsOpen ? (
        <div className="absolute right-3 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.5rem))] z-20">
          <ConstellationSettingsPopover
            settings={settings}
            onChange={updateSettings}
            onReset={() => updateSettings(DEFAULT_CONSTELLATION_SETTINGS)}
            onReorganize={() => {
              reset()
              setLayoutKey((key) => key + 1)
              setSettingsOpen(false)
            }}
            onClose={() => setSettingsOpen(false)}
          />
        </div>
      ) : null}

      {locked ? (
        <p className="pointer-events-none absolute left-3 top-28 max-w-[14rem] rounded-xl bg-[var(--cst-chrome)] px-3 py-2 text-xs text-[var(--cst-label)] sm:top-20">
          {s.toolbar.lockedHint}
        </p>
      ) : null}

      {linkMode ? (
        <div
          className={`${chromeBar} absolute left-3 top-28 z-10 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 p-3 text-sm sm:top-20`}
        >
          <div role="radiogroup" aria-label={s.toolbar.linkKind} className="flex gap-2">
            {(['related', 'depends_on'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={linkKind === kind}
                onClick={() => setLinkKind(kind)}
                className={`min-h-11 rounded-[10px] border px-3 text-sm ${
                  linkKind === kind
                    ? 'border-[var(--cst-highlight)] bg-[var(--cst-chrome-line)]'
                    : 'border-[var(--cst-chrome-line)] text-[var(--cst-label)]'
                }`}
              >
                {kind === 'related' ? s.toolbar.related : s.toolbar.dependsOn}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--cst-label)]">
            {picked ? s.toolbar.pickSecond(taskTitle(picked)) : s.toolbar.linkHint}
          </p>
        </div>
      ) : null}

      <div
        role="group"
        aria-label={s.zoom.group}
        className={`${chromeBar} absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 flex items-center gap-0.5 p-1`}
      >
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomBy(1 / 1.3)}
          disabled={locked}
          aria-label={s.toolbar.zoomOut}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--cst-chrome-line)] disabled:opacity-40"
        >
          <Minus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span
          className="w-12 text-center text-xs tabular-nums text-[var(--cst-label)]"
          data-testid="constellation-zoom"
        >
          {s.zoom.level(zoomPercent)}
        </span>
        <button
          type="button"
          onClick={() => canvasRef.current?.zoomBy(1.3)}
          disabled={locked}
          aria-label={s.toolbar.zoomIn}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--cst-chrome-line)] disabled:opacity-40"
        >
          <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[var(--cst-chrome-line)]" />
        <button
          type="button"
          onClick={() => canvasRef.current?.recenter()}
          aria-label={s.zoom.fit}
          title={s.zoom.fit}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--cst-chrome-line)]"
        >
          <LocateFixed size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={toggleLocked}
          aria-pressed={locked}
          aria-label={locked ? s.toolbar.unlock : s.toolbar.lock}
          title={locked ? s.toolbar.unlock : s.toolbar.lock}
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--cst-chrome-line)] aria-pressed:bg-[var(--cst-chrome-line)]"
        >
          {locked ? (
            <Lock size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Unlock size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
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
          className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] hover:bg-[var(--cst-chrome-line)] disabled:opacity-40 aria-pressed:bg-[var(--cst-chrome-line)]"
        >
          <Link2 size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {positions ? (
        <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-10 hidden sm:block">
          <ConstellationMinimap
            graph={graph}
            positions={positions}
            view={view}
            onNavigate={(x, y) => canvasRef.current?.centerOn(x, y)}
          />
        </div>
      ) : null}

      {hintVisible && hasTasks && !selectedNode ? (
        <p className="pointer-events-none absolute bottom-4 left-1/2 hidden -translate-x-1/2 text-xs text-[var(--cst-label)] md:block">
          {s.hint}
        </p>
      ) : null}

      {selectedEdge?.linkId ? (
        <div
          className={`${chromeBar} absolute inset-x-3 bottom-20 z-10 flex items-center gap-3 p-3 sm:left-auto sm:right-3 sm:w-80`}
        >
          <p className="min-w-0 flex-1 truncate text-sm">
            {taskTitle(selectedEdge.source)} {selectedEdge.kind === 'depends_on' ? '→' : '↔'}{' '}
            {taskTitle(selectedEdge.target)}
          </p>
          <button
            type="button"
            onClick={() => handleRemoveLink(selectedEdge.linkId!)}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-[var(--cst-chrome-line)] px-3 text-sm"
          >
            <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            {s.detail.removeLink}
          </button>
        </div>
      ) : selectedNode ? (
        <section
          aria-label={selectedNode.label}
          className={`${chromeBar} absolute inset-x-3 bottom-20 z-10 flex max-h-[40%] flex-col gap-2 overflow-y-auto p-4 sm:left-auto sm:right-3 sm:w-80`}
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
              className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--cst-label)]"
            >
              <X size={16} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
          <p className="text-xs text-[var(--cst-label)]">
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
          <p className="text-sm tabular-nums">
            {s.detail.timeSpent} : {formatFocusDuration(selectedNode.seconds)}
          </p>
          {selectedNode.kind === 'group' ? (
            <button
              type="button"
              onClick={() =>
                setExpanded(new Set([...expanded, selectedNode.pillarId ?? NO_PILLAR_NODE_ID]))
              }
              className="min-h-11 self-start rounded-[10px] border border-[var(--cst-chrome-line)] px-3 text-sm"
            >
              {s.detail.expandGroup}
            </button>
          ) : null}
          {linksOfSelected.length > 0 ? (
            <div>
              <p className="mb-1 text-xs text-[var(--cst-label)]">{s.detail.linkedTasks}</p>
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
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--cst-label)]"
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
    </div>,
    document.body,
  )
}
