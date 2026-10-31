import {
  Link2,
  LocateFixed,
  Lock,
  Minus,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Unlock,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { usePillars } from '@/features/pillars/usePillars'
import { onSessionRecorded } from '@/features/stats/session-events'
import { requestFocusOnTask, requestOpenTasks } from '@/features/tasks/panel-requests'
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
import { ConstellationInspector } from './ConstellationInspector'
import { ConstellationMinimap } from './ConstellationMinimap'
import { ConstellationSearch } from './ConstellationSearch'
import { ConstellationSettingsPopover } from './ConstellationSettingsPopover'
import { applyDisplayFilters } from './display-filters'
import { settleLayout } from './force-layout'
import type { Positions } from './force-layout'
import { depthOpacity, localSubgraph } from './local-subgraph'
import type { LocalDepth } from './local-subgraph'
import { formatShort } from './format'
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

const noopPositions = () => {}

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

/**
 * Page plein cadre de la constellation (v2, « graphe sobre ») : le graphe occupe tout l'écran,
 * l'interface flotte par-dessus — titre, puces de piliers (légende + filtre) et période, réglages,
 * pilule de zoom, mini-carte. Détail d'un nœud, cadenas de la vue et mode « relier » conservés.
 */
export function ConstellationPage({ onClose }: { onClose: () => void }) {
  const s = strings.constellation
  const { showToast } = useToast()
  const { tasks, archivedTasks, toggleDone } = useTasks()
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
  const [viewMode, setViewMode] = useState<'global' | 'local'>('global')
  const [localCenterId, setLocalCenterId] = useState<string | null>(null)
  const [localDepth, setLocalDepth] = useState<LocalDepth>(2)
  const [includePillars, setIncludePillars] = useState(true)
  const [linksOnly, setLinksOnly] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMatches, setSearchMatches] = useState<ReadonlySet<string>>(new Set())
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

  // Vue locale : sous-graphe autour d'un nœud, disposition calculée sur ce sous-graphe seulement
  // (jamais enregistrée : la disposition globale reste intacte), centre épinglé à l'origine.
  const local = useMemo(
    () =>
      viewMode === 'local' && localCenterId
        ? localSubgraph(graph, localCenterId, localDepth, { includePillars, linksOnly })
        : null,
    [viewMode, localCenterId, graph, localDepth, includePillars, linksOnly],
  )
  const isLocal = local !== null
  const shownGraph = local?.graph ?? graph
  const localPositions = useMemo<Positions | null>(() => {
    if (!local) return null
    const settled = settleLayout(local.graph, {})
    const center = settled[local.centerId] ?? { x: 0, y: 0 }
    const result: Positions = {}
    for (const [id, position] of Object.entries(settled)) {
      result[id] = { x: position.x - center.x, y: position.y - center.y }
    }
    result[local.centerId] = { x: 0, y: 0, pinned: true }
    return result
  }, [local])
  const shownPositions = local ? localPositions : positions
  const localDraw = useMemo(
    () =>
      local
        ? {
            centerId: local.centerId,
            opacityById: new Map(
              Array.from(local.depthById, ([id, depth]) => [id, depthOpacity(depth)] as const),
            ),
          }
        : null,
    [local],
  )
  const canvasLayoutKey = `${layoutKey}|${
    local ? `${local.centerId}|${localDepth}|${includePillars}|${linksOnly}` : 'global'
  }`

  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph])
  const localCenter = local ? (nodeById.get(local.centerId) ?? null) : null
  const localPillarNodeId = localCenter?.pillarId ? `p:${localCenter.pillarId}` : NO_PILLAR_NODE_ID
  const localPillarName =
    pillars.find((pillar) => pillar.id === localCenter?.pillarId)?.name ?? s.filters.noPillar
  const enterLocal = useCallback((id: string) => {
    setLocalCenterId(id)
    setViewMode('local')
    setSelectedId(id)
    setSelectedEdgeId(null)
  }, [])
  const leaveLocal = useCallback(() => setViewMode('global'), [])
  const taskTitle = useCallback(
    (id: string) => allTasks.find((task) => task.id === id)?.title ?? '',
    [allTasks],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // En vue locale, Échap revient à la vue globale (même sélection) avant de fermer la page.
      if (isLocal) leaveLocal()
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, isLocal, leaveLocal])

  // Raccourci « / » : ouvre la recherche (sauf pendant la saisie dans un champ).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setSearchOpen(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

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
    // En vue locale, sélectionner un voisin le recentre (animation douce côté canvas).
    if (id && isLocal && id !== localCenterId && nodeById.has(id)) setLocalCenterId(id)
    setSelectedId(id)
  }

  // Résultat de recherche : sélection, centrage (zoom ≥ 1,2) et inspecteur ; en vue locale, le
  // nœud devient le nouveau centre (le recadrage doux s'en charge).
  const chooseSearchResult = (id: string) => {
    setSelectedEdgeId(null)
    if (isLocal && id !== localCenterId && nodeById.has(id)) setLocalCenterId(id)
    setSelectedId(id)
    if (!isLocal) {
      const position = shownPositions?.[id]
      if (position) canvasRef.current?.focusOn(position.x, position.y, 1.2)
    }
    setSearchOpen(false)
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
      className="fixed inset-0 z-[60] flex overflow-hidden bg-[var(--cst-bg)] text-[var(--text)]"
    >
      <div className="relative min-w-0 flex-1">
        <div className="absolute inset-0">
          {shownPositions ? (
            <ConstellationCanvas
              ref={canvasRef}
              graph={shownGraph}
              positions={shownPositions}
              locked={locked}
              linkMode={linkMode}
              selectedIds={highlighted}
              selectedEdgeId={selectedEdgeId}
              labels={isLocal && settings.labels !== 'never' ? 'always' : settings.labels}
              nodeScale={settings.nodeScale}
              showArrows={settings.showArrows}
              layoutKey={canvasLayoutKey}
              local={localDraw}
              search={searchMatches}
              onViewChange={setView}
              ariaLabel={s.canvasLabel(shownGraph.nodes.length, links.length)}
              onSelectNode={handleSelectNode}
              onSelectEdge={(id) => {
                setSelectedEdgeId(id)
                setSelectedId(null)
              }}
              onLink={(from, to) => void createLink(from, to)}
              onPositionsChange={isLocal ? noopPositions : onPositionsChange}
            />
          ) : (
            <p className="p-4 pt-24 text-sm text-[var(--cst-label)]">{s.loading}</p>
          )}
        </div>

        {/* Équivalent texte du canvas : la liste des tâches visibles, atteignable au clavier
            (Entrée = sélectionner), masquée visuellement. */}
        <ul aria-label={s.a11y.listLabel} className="sr-only">
          {shownGraph.nodes
            .filter((node) => node.kind === 'task')
            .map((node) => (
              <li key={node.id}>
                <button type="button" onClick={() => handleSelectNode(node.id)}>
                  {s.a11y.item(
                    node.label,
                    node.pillarId
                      ? (pillars.find((pillar) => pillar.id === node.pillarId)?.name ?? '')
                      : s.filters.noPillar,
                    node.done ? s.search.statusDone : s.search.statusTodo,
                  )}
                </button>
              </li>
            ))}
        </ul>

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
            <div
              role="group"
              aria-label={s.local.viewGroup}
              className={`${chromeBar} mt-1.5 inline-flex gap-0.5 p-0.5`}
            >
              <button
                type="button"
                aria-pressed={!isLocal}
                onClick={leaveLocal}
                className={`min-h-11 rounded-[10px] px-3 text-sm transition-colors ${
                  !isLocal
                    ? 'bg-[var(--cst-chrome-line)] font-semibold text-[var(--text)]'
                    : 'text-[var(--cst-label)] hover:text-[var(--text)]'
                }`}
              >
                {s.local.global}
              </button>
              <button
                type="button"
                aria-pressed={isLocal}
                disabled={!isLocal && (!selectedNode || selectedNode.kind === 'group')}
                onClick={() => selectedNode && enterLocal(selectedNode.id)}
                className={`min-h-11 rounded-[10px] px-3 text-sm transition-colors disabled:opacity-40 ${
                  isLocal
                    ? 'bg-[var(--cst-chrome-line)] font-semibold text-[var(--text)]'
                    : 'text-[var(--cst-label)] hover:text-[var(--text)]'
                }`}
              >
                {s.local.local}
              </button>
            </div>
          </div>

          {searchOpen ? (
            <div className="pointer-events-none order-3 flex w-full min-w-0 justify-center sm:order-none sm:flex-1">
              <ConstellationSearch
                nodes={shownGraph.nodes}
                pillarName={(pillarId) =>
                  pillarId
                    ? (pillars.find((pillar) => pillar.id === pillarId)?.name ?? '')
                    : s.filters.noPillar
                }
                onClose={() => setSearchOpen(false)}
                onChoose={chooseSearchResult}
                onMatchesChange={setSearchMatches}
              />
            </div>
          ) : local && localCenter ? (
            <nav
              aria-label={s.local.breadcrumb}
              className="pointer-events-none order-3 flex w-full min-w-0 justify-center sm:order-none sm:flex-1"
            >
              <ol
                className={`${chromeBar} pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto px-2 py-1 text-sm`}
              >
                <li>
                  <button
                    type="button"
                    onClick={leaveLocal}
                    className="min-h-11 whitespace-nowrap rounded-[10px] px-2 text-[var(--cst-label)] hover:text-[var(--text)]"
                  >
                    {s.local.root}
                  </button>
                </li>
                {localCenter.kind === 'task' || localCenter.kind === 'group' ? (
                  <>
                    <li aria-hidden="true" className="text-[var(--cst-label)]">
                      ›
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={!nodeById.has(localPillarNodeId)}
                        onClick={() => enterLocal(localPillarNodeId)}
                        className="flex min-h-11 items-center gap-2 whitespace-nowrap rounded-[10px] px-2 text-[var(--cst-label)] hover:text-[var(--text)] disabled:hover:text-[var(--cst-label)]"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ background: localCenter.color }}
                        />
                        {localPillarName}
                      </button>
                    </li>
                  </>
                ) : null}
                <li aria-hidden="true" className="text-[var(--cst-label)]">
                  ›
                </li>
                <li
                  aria-current="page"
                  className="whitespace-nowrap px-2 font-semibold text-[var(--text)]"
                >
                  {localCenter.label}
                </li>
              </ol>
            </nav>
          ) : (
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
                <div
                  role="group"
                  aria-label={s.pillarBar.periodLabel}
                  className="flex shrink-0 gap-1"
                >
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
          )}

          <div className="pointer-events-auto flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-pressed={searchOpen}
              aria-label={s.search.open}
              title={`${s.search.open} (${s.search.shortcutHint})`}
              className={chromeButton}
            >
              <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
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

        {isLocal ? (
          <div
            role="group"
            aria-label={s.local.cardLabel}
            className={`${chromeBar} absolute left-3 top-[8.5rem] z-10 flex w-52 flex-col gap-1 p-3 text-sm sm:top-[7rem]`}
          >
            <p className="text-xs text-[var(--cst-label)]">{s.local.depth}</p>
            <div
              role="group"
              aria-label={s.local.depth}
              className="grid grid-cols-3 gap-1 rounded-xl bg-[var(--cst-bg)] p-1"
            >
              {([1, 2, 3] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={localDepth === value}
                  onClick={() => setLocalDepth(value)}
                  className={`min-h-11 rounded-lg tabular-nums transition-colors ${
                    localDepth === value
                      ? 'bg-[var(--cst-chrome-line)] font-semibold text-[var(--text)]'
                      : 'text-[var(--cst-label)] hover:text-[var(--text)]'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              {s.local.includePillars}
              <input
                type="checkbox"
                checked={includePillars}
                onChange={(event) => setIncludePillars(event.target.checked)}
                className="h-5 w-5 accent-[var(--accent)]"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
              {s.local.linksOnly}
              <input
                type="checkbox"
                checked={linksOnly}
                onChange={(event) => setLinksOnly(event.target.checked)}
                className="h-5 w-5 accent-[var(--accent)]"
              />
            </label>
          </div>
        ) : null}

        {locked ? (
          <p className="pointer-events-none absolute bottom-20 left-3 max-w-[14rem] rounded-xl bg-[var(--cst-chrome)] px-3 py-2 text-xs text-[var(--cst-label)]">
            {s.toolbar.lockedHint}
          </p>
        ) : null}

        {linkMode ? (
          <div
            className={`${chromeBar} absolute bottom-20 left-3 z-10 flex max-w-[calc(100vw-1.5rem)] flex-col gap-2 p-3 text-sm`}
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

        {shownPositions ? (
          <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] right-3 z-10 hidden sm:block">
            <ConstellationMinimap
              graph={shownGraph}
              positions={shownPositions ?? {}}
              view={view}
              onNavigate={(x, y) => canvasRef.current?.centerOn(x, y)}
            />
          </div>
        ) : null}

        {isLocal && local ? (
          <p
            data-testid="constellation-local-status"
            className="pointer-events-none absolute bottom-5 left-[20.5rem] hidden items-center gap-3 text-xs text-[var(--cst-label)] md:flex"
          >
            <span className="tabular-nums">
              {s.local.status(
                local.graph.nodes.filter((node) => node.kind === 'task').length,
                fullGraph.stats.tasksTotal,
                localDepth,
              )}
            </span>
            <span>
              <kbd className="rounded border border-[var(--cst-chrome-line)] px-1.5 py-0.5 font-sans">
                {s.local.escape}
              </kbd>{' '}
              {s.local.escapeHint}
            </span>
          </p>
        ) : null}

        {!isLocal && hintVisible && hasTasks && !selectedNode ? (
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
        ) : null}
      </div>

      {selectedNode ? (
        <ConstellationInspector
          node={selectedNode}
          tasks={allTasks}
          pillars={pillars}
          sessions={sessions}
          links={links}
          period={period}
          now={now}
          onClose={() => setSelectedId(null)}
          onSelectNode={handleSelectNode}
          onStartLink={(taskId) => {
            if (locked) toggleLocked()
            setSelectedId(null)
            setLinkMode(true)
            setPicked(taskId)
          }}
          onRemoveLink={handleRemoveLink}
          onOpenTask={() => {
            onClose()
            requestOpenTasks()
          }}
          onMarkDone={(taskId) => void toggleDone(taskId)}
          onStartFocus={(taskId) => {
            onClose()
            requestFocusOnTask(taskId)
          }}
          onExpandGroup={(key) => setExpanded(new Set([...expanded, key]))}
          onViewLocal={enterLocal}
        />
      ) : null}
    </div>,
    document.body,
  )
}
