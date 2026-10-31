import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useImperativeHandle } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { TaskRecord } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { ConstellationPage } from './ConstellationPage'

// jsdom n'a pas de canvas 2D : le canvas est remplacé par une maquette qui expose les nœuds sous
// forme de boutons et les callbacks de geste (sélection, lien glissé). Le canvas lui-même est
// couvert par view-transform / force-layout / draw-constellation et le test e2e.
vi.mock('./ConstellationCanvas', () => ({
  ConstellationCanvas: forwardRef(function Mock(
    props: {
      graph: { nodes: { id: string; label: string; kind: string }[] }
      locked: boolean
      linkMode: boolean
      ariaLabel: string
      onSelectNode: (id: string | null) => void
      onLink: (from: string, to: string) => void
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ recenter: vi.fn(), zoomBy: vi.fn() }))
    return (
      <div
        data-testid="constellation-canvas"
        data-locked={props.locked}
        data-linkmode={props.linkMode}
      >
        <span>{props.ariaLabel}</span>
        {props.graph.nodes.map((node) => (
          <button key={node.id} type="button" onClick={() => props.onSelectNode(node.id)}>
            nœud {node.label}
          </button>
        ))}
        <button type="button" onClick={() => props.onLink('ta', 'tb')}>
          glisser A vers B
        </button>
      </div>
    )
  }),
}))

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
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }
}

async function reset(tasks: TaskRecord[]) {
  const db = await getDb()
  for (const store of [
    'tasks',
    'taskLinks',
    'focusSessions',
    'syncQueue',
    'constellationLayout',
  ] as const) {
    const keys = await db.getAllKeys(store)
    await Promise.all(keys.map((key) => db.delete(store, key)))
  }
  for (const t of tasks) await db.put('tasks', t)
}

function renderPage(onClose = vi.fn()) {
  return {
    onClose,
    ...render(
      <ToastProvider>
        <ConstellationPage onClose={onClose} />
      </ToastProvider>,
    ),
  }
}

describe('ConstellationPage', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await reset([task('ta', 'Réviser'), task('tb', 'Rédiger', { done: true, doneAt: Date.now() })])
  })

  it('affiche les indicateurs : tâches terminées et temps de focus', async () => {
    renderPage()
    expect(await screen.findByText('1 / 2 tâches terminées')).toBeInTheDocument()
    expect(screen.getByText(/Temps de focus : 0 min/)).toBeInTheDocument()
  })

  it('le cadenas verrouille la vue, se souvient du choix et bloque le mode relier', async () => {
    const user = userEvent.setup()
    renderPage()
    const canvas = await screen.findByTestId('constellation-canvas')
    expect(canvas).toHaveAttribute('data-locked', 'false')

    await user.click(screen.getByRole('button', { name: 'Relier des tâches' }))
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-linkmode', 'true')

    await user.click(screen.getByRole('button', { name: 'Verrouiller la vue' }))
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-locked', 'true')
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-linkmode', 'false')
    expect(screen.getByText('Vue verrouillée : les gestes ne bougent rien.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Relier des tâches' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Zoomer' })).toBeDisabled()
    expect(window.localStorage.getItem('flowquest.constellationLocked')).toBe('1')

    await user.click(screen.getByRole('button', { name: 'Déverrouiller la vue' }))
    expect(screen.getByRole('button', { name: 'Relier des tâches' })).toBeEnabled()
  })

  it('démarre verrouillée si le choix a été mémorisé', async () => {
    window.localStorage.setItem('flowquest.constellationLocked', '1')
    renderPage()
    expect(await screen.findByTestId('constellation-canvas')).toHaveAttribute('data-locked', 'true')
  })

  it('relie deux tâches en les touchant l’une après l’autre', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Relier des tâches' }))
    await user.click(screen.getByRole('radio', { name: 'Dépend de' }))

    await user.click(screen.getByRole('button', { name: 'nœud Réviser' }))
    expect(screen.getByText('« Réviser » → touche la seconde tâche')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'nœud Rédiger' }))

    expect(await screen.findByText('Lien créé')).toBeInTheDocument()
    const db = await getDb()
    await waitFor(async () => expect(await db.count('taskLinks')).toBe(1))
    const [link] = await db.getAll('taskLinks')
    expect(link).toMatchObject({ fromTaskId: 'ta', toTaskId: 'tb', kind: 'depends_on' })
  })

  it('relie par glisser, refuse un doublon avec un message clair', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Relier des tâches' }))

    await user.click(screen.getByRole('button', { name: 'glisser A vers B' }))
    expect(await screen.findByText('Lien créé')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'glisser A vers B' }))
    expect(await screen.findByText('Ces deux tâches sont déjà liées.')).toBeInTheDocument()
    expect(await (await getDb()).count('taskLinks')).toBe(1)
  })

  it('ne relie pas un pilier : seules les tâches se relient', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Relier des tâches' }))
    await user.click(await screen.findByRole('button', { name: /nœud Général/ }))
    expect(await screen.findByText('Seules les tâches peuvent être reliées.')).toBeInTheDocument()
  })

  it('le détail d’une tâche liste ses liens et permet de les supprimer, avec annulation', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put('taskLinks', {
      id: 'l1',
      fromTaskId: 'ta',
      toTaskId: 'tb',
      kind: 'depends_on',
      createdAt: 1,
    })
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'nœud Réviser' }))
    const detail = await screen.findByRole('region', { name: 'Réviser' })
    expect(within(detail).getByText('À faire')).toBeInTheDocument()
    expect(within(detail).getByText('Dépend de : Rédiger')).toBeInTheDocument()

    await user.click(within(detail).getByRole('button', { name: /Supprimer le lien/ }))
    expect(await screen.findByText('Lien supprimé')).toBeInTheDocument()
    await waitFor(async () => expect(await db.count('taskLinks')).toBe(0))

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(async () => expect(await db.count('taskLinks')).toBe(1))
  })

  it('le filtre « sans pilier » et la case des archivées modifient le graphe', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put('tasks', task('tz', 'Ancienne', { archivedAt: Date.now() }))
    renderPage()

    expect(await screen.findByRole('button', { name: 'nœud Réviser' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'nœud Ancienne' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Afficher les archivées' }))
    expect(await screen.findByRole('button', { name: 'nœud Ancienne' })).toBeInTheDocument()
  })

  it('se ferme via Échap et via le bouton', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPage()
    await screen.findByTestId('constellation-canvas')
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: 'Fermer la constellation' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
