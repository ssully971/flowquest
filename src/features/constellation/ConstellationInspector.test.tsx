import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

import type { GraphNode } from './build-graph'
import { ConstellationInspector } from './ConstellationInspector'

const NOW = new Date(2026, 9, 28, 12).getTime()
const DAY = 86_400_000

const pillars: PillarRecord[] = [
  {
    id: 'p1',
    name: 'Projet perso',
    color: '#F2924A',
    currentXp: 0,
    level: 5,
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
  },
  {
    id: 'p2',
    name: 'Études',
    color: '#4A9FE8',
    currentXp: 0,
    level: 1,
    createdAt: 0,
    archivedAt: null,
    goalLevel: null,
    goalDeadline: null,
  },
]

function task(id: string, title: string, overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id,
    title,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
    position: 0,
    done: false,
    doneAt: null,
    createdAt: NOW - 90 * DAY,
    updatedAt: NOW,
    pillarId: 'p1',
    ...overrides,
  }
}

const tasks = [
  task('a', 'Mode amis', { done: true, doneAt: new Date(2026, 9, 27, 10).getTime() }),
  task('b', 'Bêta fermée'),
  task('c', 'Lecture ECG', { pillarId: 'p2' }),
]
const links: TaskLinkRecord[] = [
  { id: 'l1', fromTaskId: 'b', toTaskId: 'a', kind: 'depends_on', createdAt: 0 },
  { id: 'l2', fromTaskId: 'b', toTaskId: 'c', kind: 'related', createdAt: 0 },
]
const session = (taskId: string, seconds: number, startedAt: number): FocusSessionRecord => ({
  id: `${taskId}-${startedAt}`,
  kind: 'focus',
  plannedSeconds: seconds,
  actualSeconds: seconds,
  startedAt,
  endedAt: startedAt + seconds * 1000,
  completed: true,
  taskId,
  pillarId: null,
  syncedAt: null,
})
const sessions = [
  session('a', 5400, NOW - 3 * DAY),
  session('a', 3600, NOW - 10 * DAY),
  session('b', 2700, NOW - DAY),
]

const node = (id: string, overrides: Partial<GraphNode> = {}): GraphNode => ({
  id,
  kind: 'task',
  label: tasks.find((t) => t.id === id)?.title ?? id,
  pillarId: 'p1',
  color: '#F2924A',
  radius: 8,
  brightness: 1,
  done: false,
  archived: false,
  seconds: 0,
  ...overrides,
})

function renderInspector(
  target: GraphNode,
  extra: Partial<React.ComponentProps<typeof ConstellationInspector>> = {},
) {
  const handlers = {
    onClose: vi.fn(),
    onSelectNode: vi.fn(),
    onStartLink: vi.fn(),
    onRemoveLink: vi.fn(),
    onOpenTask: vi.fn(),
    onMarkDone: vi.fn(),
    onStartFocus: vi.fn(),
    onExpandGroup: vi.fn(),
  }
  render(
    <ConstellationInspector
      node={target}
      tasks={tasks}
      pillars={pillars}
      sessions={sessions}
      links={links}
      period="90d"
      now={NOW}
      {...handlers}
      {...extra}
    />,
  )
  return handlers
}

describe('ConstellationInspector — tâche terminée', () => {
  it('affiche pilier, titre, statut daté, temps, sessions et histogramme hebdomadaire', () => {
    renderInspector(node('a', { done: true }))
    expect(screen.getByText('Projet perso')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mode amis' })).toBeInTheDocument()
    expect(screen.getByText(/Terminée le 27 oct\./)).toBeInTheDocument()
    expect(screen.getByText('2 h 30')).toBeInTheDocument() // 5400 + 3600 s
    expect(screen.getByText('2')).toBeInTheDocument() // sessions
    const bars = screen.getAllByTestId('constellation-week-bar')
    expect(bars.length).toBeGreaterThanOrEqual(13)
    expect(bars.some((bar) => bar.getAttribute('data-empty') === 'true')).toBe(true)
    expect(bars.some((bar) => bar.getAttribute('data-empty') === 'false')).toBe(true)
    expect(
      screen.getByRole('img', { name: /Focus par semaine sur \d+ semaines/ }),
    ).toBeInTheDocument()
  })

  it('pied : « Ouvrir la tâche » et « Lancer un focus »', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(node('a', { done: true }))
    await user.click(screen.getByRole('button', { name: 'Ouvrir la tâche' }))
    await user.click(screen.getByRole('button', { name: 'Lancer un focus' }))
    expect(handlers.onOpenTask).toHaveBeenCalledWith('a')
    expect(handlers.onStartFocus).toHaveBeenCalledWith('a')
    expect(screen.queryByRole('button', { name: 'Marquer terminée' })).not.toBeInTheDocument()
  })
})

describe('ConstellationInspector — tâche à faire', () => {
  it('statut « À faire », encart « Débloquée » quand la dépendance est terminée', () => {
    renderInspector(node('b'))
    expect(screen.getByText('À faire')).toBeInTheDocument()
    expect(screen.getByTestId('constellation-unlock')).toHaveTextContent(
      'Débloquée : Mode amis est terminée, tu peux t’y mettre.',
    )
  })

  it('encart neutre listant ce qui bloque tant qu’une dépendance n’est pas terminée', () => {
    renderInspector(node('b'), {
      tasks: tasks.map((t) => (t.id === 'a' ? { ...t, done: false, doneAt: null } : t)),
    })
    expect(screen.getByTestId('constellation-unlock')).toHaveTextContent('Bloquée par : Mode amis')
  })

  it('pied : « Marquer terminée » à la place de « Ouvrir la tâche »', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(node('b'))
    await user.click(screen.getByRole('button', { name: 'Marquer terminée' }))
    expect(handlers.onMarkDone).toHaveBeenCalledWith('b')
    expect(screen.queryByRole('button', { name: 'Ouvrir la tâche' })).not.toBeInTheDocument()
  })

  it('liens : une ligne par lien avec son statut, pilier si différent, clic = sélection', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(node('b'))
    const dependsOn = screen.getByRole('button', { name: /Dépend de.*Mode amis/ })
    expect(dependsOn).toHaveTextContent('terminée')
    const related = screen.getByRole('button', { name: /Liée à.*Lecture ECG/ })
    expect(related).toHaveTextContent('Études')
    expect(related).toHaveTextContent('à faire')

    await user.click(related)
    expect(handlers.onSelectNode).toHaveBeenCalledWith('c')
  })

  it('« Relier à une tâche » lance le mode relier, la suppression d’un lien est conservée', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(node('b'))
    await user.click(screen.getByRole('button', { name: 'Relier à une tâche' }))
    expect(handlers.onStartLink).toHaveBeenCalledWith('b')

    await user.click(screen.getByRole('button', { name: 'Supprimer le lien : Mode amis' }))
    expect(handlers.onRemoveLink).toHaveBeenCalledWith('l1')
  })

  it('« Débloque » : les tâches qui dépendent de celle-ci', () => {
    renderInspector(node('a', { done: true }))
    expect(screen.getByRole('button', { name: /Débloque.*Bêta fermée/ })).toBeInTheDocument()
  })

  it('se désélectionne par la croix et par la poignée de la feuille', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(node('b'))
    await user.click(screen.getByRole('button', { name: 'Désélectionner' }))
    await user.click(screen.getByRole('button', { name: 'Fermer le panneau' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(2)
  })
})

describe('ConstellationInspector — pilier et groupe', () => {
  it('pilier : palier et niveau, heures, tâches terminées, bouton de vue locale', async () => {
    const user = userEvent.setup()
    const onViewLocal = vi.fn()
    renderInspector(
      node('p:p1', { kind: 'pillar', label: 'Projet perso', level: 5, pillarId: 'p1' }),
      { onViewLocal },
    )
    expect(screen.getByText('Apprenti · niveau 5')).toBeInTheDocument()
    expect(screen.getByText('1 / 2 tâches terminées')).toBeInTheDocument()
    expect(screen.getByText('3 h 15')).toBeInTheDocument() // 5400 + 3600 + 2700 s
    await user.click(screen.getByRole('button', { name: 'Voir en vue locale' }))
    expect(onViewLocal).toHaveBeenCalledWith('p:p1')
    expect(screen.queryByRole('button', { name: 'Lancer un focus' })).not.toBeInTheDocument()
  })

  it('pilier sans vue locale branchée : pas de bouton', () => {
    renderInspector(
      node('p:p1', { kind: 'pillar', label: 'Projet perso', level: 5, pillarId: 'p1' }),
    )
    expect(screen.queryByRole('button', { name: 'Voir en vue locale' })).not.toBeInTheDocument()
  })

  it('groupe : nombre de tâches regroupées et bouton pour les déplier', async () => {
    const user = userEvent.setup()
    const handlers = renderInspector(
      node('g:p1', { kind: 'group', label: '+12', groupCount: 12, seconds: 3600 }),
    )
    const aside = screen.getByTestId('constellation-inspector')
    expect(within(aside).getByText('12 tâches terminées regroupées')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Déplier ces tâches' }))
    expect(handlers.onExpandGroup).toHaveBeenCalledWith('p1')
  })
})
