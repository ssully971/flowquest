import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { forwardRef, useEffect, useImperativeHandle } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getDb } from '@/shared/storage/db'
import type { TaskRecord } from '@/shared/storage/db'
import { ToastProvider } from '@/shared/toast'

import { ConstellationPage } from './ConstellationPage'

// jsdom n'a pas de canvas 2D : le canvas est remplacé par une maquette qui expose les nœuds sous
// forme de boutons et les callbacks de geste (sélection, lien glissé). Le canvas lui-même est
// couvert par view-transform / force-layout / draw-constellation et le test e2e.
const centerOnMock = vi.fn()
const focusOnMock = vi.fn()

vi.mock('./ConstellationCanvas', () => ({
  ConstellationCanvas: forwardRef(function Mock(
    props: {
      graph: { nodes: { id: string; label: string; kind: string }[] }
      locked: boolean
      linkMode: boolean
      labels?: string
      nodeScale?: number
      showArrows?: boolean
      local?: { centerId: string } | null
      search?: ReadonlySet<string> | null
      layoutKey?: number | string
      onViewChange?: (view: {
        x: number
        y: number
        k: number
        width: number
        height: number
      }) => void
      ariaLabel: string
      onSelectNode: (id: string | null) => void
      onLink: (from: string, to: string) => void
    },
    ref,
  ) {
    useImperativeHandle(ref, () => ({
      recenter: vi.fn(),
      zoomBy: vi.fn(),
      centerOn: centerOnMock,
      focusOn: focusOnMock,
    }))
    const { onViewChange } = props
    useEffect(() => {
      onViewChange?.({ x: 0, y: 0, k: 1.5, width: 800, height: 600 })
    }, [onViewChange])
    return (
      <div
        data-testid="constellation-canvas"
        data-locked={props.locked}
        data-linkmode={props.linkMode}
        data-labels={props.labels}
        data-nodescale={props.nodeScale}
        data-arrows={String(props.showArrows)}
        data-local-center={props.local?.centerId}
        data-search={props.search ? Array.from(props.search).sort().join(',') : ''}
        data-layoutkey={String(props.layoutKey)}
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
    expect(await screen.findByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('0 min')).toBeInTheDocument()
    expect(screen.getByText(/terminées/)).toBeInTheDocument()
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

  it('l’inspecteur d’une tâche liste ses liens (cliquables) et permet de les supprimer, avec annulation', async () => {
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
    const inspector = await screen.findByRole('complementary', { name: 'Réviser' })
    expect(within(inspector).getByText('À faire')).toBeInTheDocument()
    expect(within(inspector).getByText('Dépend de')).toBeInTheDocument()
    expect(within(inspector).getByTestId('constellation-unlock')).toHaveTextContent(
      'Débloquée : Rédiger est terminée, tu peux t’y mettre.',
    )

    await user.click(within(inspector).getByRole('button', { name: 'Supprimer le lien : Rédiger' }))
    expect(await screen.findByText('Lien supprimé')).toBeInTheDocument()
    await waitFor(async () => expect(await db.count('taskLinks')).toBe(0))

    await user.click(screen.getByRole('button', { name: 'Annuler' }))
    await waitFor(async () => expect(await db.count('taskLinks')).toBe(1))
  })

  it('la case des archivées est dans les réglages d’affichage', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put('tasks', task('tz', 'Ancienne', { archivedAt: Date.now() }))
    renderPage()

    expect(await screen.findByRole('button', { name: 'nœud Réviser' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'nœud Ancienne' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Réglages d’affichage' }))
    await user.click(screen.getByRole('checkbox', { name: 'Tâches archivées' }))
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

  it('les puces de piliers servent de légende et de filtre', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put('pillars', {
      id: 'p1',
      name: 'Études',
      color: '#4A9FE8',
      currentXp: 0,
      level: 1,
      createdAt: 1,
      archivedAt: null,
      goalLevel: null,
      goalDeadline: null,
    })
    await db.put('tasks', task('tp', 'Anatomie', { pillarId: 'p1' }))
    await db.put('focusSessions', {
      id: 's1',
      kind: 'focus',
      plannedSeconds: 3600,
      actualSeconds: 3600,
      startedAt: Date.now() - 1000,
      endedAt: Date.now(),
      completed: true,
      taskId: 'tp',
      pillarId: 'p1',
      syncedAt: null,
    })
    renderPage()

    const chip = await screen.findByRole('button', { name: 'Masquer Études' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip).toHaveTextContent('1 h') // heures du pilier dans la puce
    expect(screen.getByRole('button', { name: 'nœud Anatomie' })).toBeInTheDocument()

    await user.click(chip)
    expect(screen.getByRole('button', { name: 'Afficher Études' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.queryByRole('button', { name: 'nœud Anatomie' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'nœud Réviser' })).toBeInTheDocument() // autres piliers intacts

    await user.click(screen.getByRole('button', { name: 'Afficher Études' }))
    expect(screen.getByRole('button', { name: 'nœud Anatomie' })).toBeInTheDocument()
  })

  it('un pilier sans tâche a une puce estompée', async () => {
    renderPage()
    const chip = await screen.findByRole('button', { name: 'Masquer Général' })
    expect(chip.className).toContain('opacity-50')
  })

  it('le segment de période est un groupe de boutons (30 j / 90 j / Tout)', async () => {
    const user = userEvent.setup()
    renderPage()
    const group = await screen.findByRole('group', { name: 'Période' })
    expect(within(group).getByRole('button', { name: '90 j' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await user.click(within(group).getByRole('button', { name: 'Tout' }))
    expect(within(group).getByRole('button', { name: 'Tout' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(group).getByRole('button', { name: '90 j' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('réglages d’affichage : étiquettes, flèches, taille, mémorisés, réinitialisables', async () => {
    const user = userEvent.setup()
    renderPage()
    const canvas = await screen.findByTestId('constellation-canvas')
    expect(canvas).toHaveAttribute('data-labels', 'auto')

    await user.click(screen.getByRole('button', { name: 'Réglages d’affichage' }))
    const popover = screen.getByTestId('constellation-settings')
    await user.click(within(popover).getByRole('button', { name: 'Jamais' }))
    await user.click(within(popover).getByRole('checkbox', { name: 'Flèches de dépendance' }))
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-labels', 'never')
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-arrows', 'false')
    expect(
      JSON.parse(window.localStorage.getItem('flowquest.constellationSettings')!),
    ).toMatchObject({
      labels: 'never',
      showArrows: false,
    })

    await user.click(within(popover).getByRole('button', { name: 'Réinitialiser' }))
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-labels', 'auto')
    expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-arrows', 'true')
  })

  it('le popover se ferme avec Échap sans fermer la page', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPage()
    await user.click(await screen.findByRole('button', { name: 'Réglages d’affichage' }))
    expect(screen.getByTestId('constellation-settings')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('constellation-settings')).not.toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('« Réorganiser le graphe » oublie les positions enregistrées', async () => {
    const user = userEvent.setup()
    const db = await getDb()
    await db.put(
      'constellationLayout',
      { positions: { ta: { x: 999, y: 999, pinned: true } }, updatedAt: 1 },
      'current',
    )
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Réglages d’affichage' }))
    await user.click(screen.getByRole('button', { name: 'Réorganiser le graphe' }))

    await waitFor(
      async () => {
        const layout = await db.get('constellationLayout', 'current')
        expect(layout?.positions.ta?.pinned).toBeUndefined()
        expect(layout?.positions.ta?.x).not.toBe(999)
      },
      { timeout: 3000 },
    )
  })

  it('affiche le pourcentage de zoom de la vue et une mini-carte qui recentre la vue', async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByTestId('constellation-zoom')).toHaveTextContent('150 %'))

    const minimap = screen.getByTestId('constellation-minimap')
    expect(minimap).toHaveAttribute('aria-label', 'Mini-carte de la constellation')
    await user.pointer({ keys: '[MouseLeft>]', target: minimap })
    expect(centerOnMock).toHaveBeenCalled()
  })

  it('l’aide « Glisse un nœud » disparaît après la première interaction, pour de bon', async () => {
    const user = userEvent.setup()
    const { unmount } = renderPage()
    expect(await screen.findByText(/Glisse un nœud pour le placer/)).toBeInTheDocument()

    await user.pointer({ keys: '[MouseLeft]', target: screen.getByTestId('constellation-canvas') })
    expect(screen.queryByText(/Glisse un nœud pour le placer/)).not.toBeInTheDocument()
    unmount()

    renderPage()
    await screen.findByTestId('constellation-canvas')
    expect(screen.queryByText(/Glisse un nœud pour le placer/)).not.toBeInTheDocument()
  })

  describe('vue locale', () => {
    async function seedLocal() {
      const db = await getDb()
      await db.put('pillars', {
        id: 'p1',
        name: 'Études',
        color: '#4A9FE8',
        currentXp: 0,
        level: 5,
        createdAt: 1,
        archivedAt: null,
        goalLevel: null,
        goalDeadline: null,
      })
      for (const [id, title] of [
        ['la', 'Alpha'],
        ['lb', 'Bravo'],
        ['lc', 'Charlie'],
      ]) {
        await db.put('tasks', task(id, title, { pillarId: 'p1' }))
      }
      await db.put('taskLinks', {
        id: 'x1',
        fromTaskId: 'la',
        toTaskId: 'lb',
        kind: 'depends_on',
        createdAt: 1,
      })
    }

    it('« Locale » est désactivé tant que rien n’est sélectionné, puis ouvre la vue locale', async () => {
      const user = userEvent.setup()
      await seedLocal()
      renderPage()
      const group = await screen.findByRole('group', { name: 'Vue' })
      expect(within(group).getByRole('button', { name: 'Locale' })).toBeDisabled()
      expect(within(group).getByRole('button', { name: 'Globale' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )

      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(within(group).getByRole('button', { name: 'Locale' }))

      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-local-center', 'la')
      expect(within(group).getByRole('button', { name: 'Locale' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(screen.getByRole('navigation', { name: 'Fil d’Ariane' })).toHaveTextContent(
        'Tous les piliers›Études›Alpha',
      )
      expect(screen.getByRole('group', { name: 'Réglages de la vue locale' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true') // profondeur 2 par défaut
    })

    it('la profondeur et « inclure les piliers » changent les nœuds affichés', async () => {
      const user = userEvent.setup()
      await seedLocal()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Locale' }))

      // Profondeur 2 : Alpha → Bravo (lien), Alpha → Études → Charlie (via le pilier).
      expect(screen.getByRole('button', { name: 'nœud Charlie' })).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: '1' }))
      expect(screen.queryByRole('button', { name: 'nœud Charlie' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'nœud Bravo' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'nœud Études' })).toBeInTheDocument()

      await user.click(screen.getByRole('checkbox', { name: 'Inclure les piliers' }))
      expect(screen.queryByRole('button', { name: 'nœud Études' })).not.toBeInTheDocument()
    })

    it('sélectionner un voisin le recentre ; la fenêtre affiche « Vue locale · N tâches sur M »', async () => {
      const user = userEvent.setup()
      await seedLocal()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Locale' }))
      const before = screen.getByTestId('constellation-canvas').getAttribute('data-layoutkey')

      await user.click(screen.getByRole('button', { name: 'nœud Bravo' }))
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-local-center', 'lb')
      expect(screen.getByTestId('constellation-canvas').getAttribute('data-layoutkey')).not.toBe(
        before,
      )
      expect(screen.getByRole('navigation', { name: 'Fil d’Ariane' })).toHaveTextContent('Bravo')
      expect(screen.getByTestId('constellation-local-status')).toHaveTextContent(
        /Vue locale · \d+ tâches? sur \d+ · profondeur 2/,
      )
    })

    it('Échap revient à la vue globale avec la même sélection, puis ferme la page', async () => {
      const user = userEvent.setup()
      await seedLocal()
      const { onClose } = renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Locale' }))

      await user.keyboard('{Escape}')
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByTestId('constellation-canvas')).not.toHaveAttribute('data-local-center')
      expect(screen.getByRole('complementary', { name: 'Alpha' })).toBeInTheDocument() // sélection gardée

      await user.keyboard('{Escape}')
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('le fil d’Ariane : le pilier recentre sur lui, « Tous les piliers » revient au global', async () => {
      const user = userEvent.setup()
      await seedLocal()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Locale' }))

      const nav = screen.getByRole('navigation', { name: 'Fil d’Ariane' })
      await user.click(within(nav).getByRole('button', { name: 'Études' }))
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute(
        'data-local-center',
        'p:p1',
      )

      await user.click(
        within(screen.getByRole('navigation', { name: 'Fil d’Ariane' })).getByRole('button', {
          name: 'Tous les piliers',
        }),
      )
      expect(screen.getByTestId('constellation-canvas')).not.toHaveAttribute('data-local-center')
    })

    it('l’inspecteur d’un pilier propose « Voir en vue locale »', async () => {
      const user = userEvent.setup()
      await seedLocal()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Études' }))
      await user.click(screen.getByRole('button', { name: 'Voir en vue locale' }))
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute(
        'data-local-center',
        'p:p1',
      )
    })

    it('les positions de la vue locale ne touchent pas la disposition enregistrée', async () => {
      const user = userEvent.setup()
      await seedLocal()
      const db = await getDb()
      await db.put(
        'constellationLayout',
        { positions: { la: { x: 321, y: 123 } }, updatedAt: 1 },
        'current',
      )
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'nœud Alpha' }))
      await user.click(screen.getByRole('button', { name: 'Locale' }))
      await new Promise((resolve) => setTimeout(resolve, 1200)) // laisse passer l'enregistrement différé
      expect((await db.get('constellationLayout', 'current'))?.positions.la).toEqual({
        x: 321,
        y: 123,
      })
    })
  })

  describe('recherche', () => {
    async function seedSearch() {
      const db = await getDb()
      await db.put('pillars', {
        id: 'p1',
        name: 'Études',
        color: '#4A9FE8',
        currentXp: 0,
        level: 1,
        createdAt: 1,
        archivedAt: null,
        goalLevel: null,
        goalDeadline: null,
      })
      await db.put('tasks', task('s1', 'Anatomie du pied', { pillarId: 'p1' }))
      await db.put(
        'tasks',
        task('s2', 'Anatomie du genou', { pillarId: 'p1', done: true, doneAt: Date.now() }),
      )
      await db.put('tasks', task('s3', 'Pharmaco', { pillarId: 'p1' }))
    }

    it('la loupe et le raccourci « / » ouvrent le champ ; Échap le ferme sans fermer la page', async () => {
      const user = userEvent.setup()
      const { onClose } = renderPage()
      await screen.findByTestId('constellation-canvas')

      await user.click(screen.getByRole('button', { name: 'Rechercher une tâche' }))
      expect(screen.getByRole('combobox', { name: 'Rechercher une tâche' })).toHaveFocus()

      await user.keyboard('{Escape}')
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(onClose).not.toHaveBeenCalled()

      await user.keyboard('/')
      expect(screen.getByRole('combobox', { name: 'Rechercher une tâche' })).toHaveFocus()
      expect(screen.getByRole('combobox')).toHaveValue('') // le « / » n'est pas tapé dans le champ
    })

    it('liste au plus 8 résultats (nom, pilier, statut) et estompe les autres nœuds', async () => {
      const user = userEvent.setup()
      await seedSearch()
      renderPage()
      await screen.findByRole('button', { name: 'nœud Pharmaco' })
      await user.click(screen.getByRole('button', { name: 'Rechercher une tâche' }))
      await user.type(screen.getByRole('combobox'), 'anato')

      const list = screen.getByRole('listbox', { name: 'Résultats de la recherche' })
      const options = within(list).getAllByRole('option')
      expect(options).toHaveLength(2)
      expect(options[0]).toHaveTextContent('Anatomie du genou')
      expect(options[0]).toHaveTextContent('Études')
      expect(options[0]).toHaveTextContent('terminée')
      expect(options[1]).toHaveTextContent('à faire')
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-search', 's1,s2')
    })

    it('choisir un résultat le sélectionne, centre la vue (zoom ≥ 1,2) et ouvre l’inspecteur', async () => {
      const user = userEvent.setup()
      await seedSearch()
      focusOnMock.mockClear()
      renderPage()
      await screen.findByRole('button', { name: 'nœud Pharmaco' })
      await user.click(screen.getByRole('button', { name: 'Rechercher une tâche' }))
      await user.type(screen.getByRole('combobox'), 'pharm')
      await user.click(screen.getByRole('option', { name: /Pharmaco/ }))

      expect(focusOnMock).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), 1.2)
      expect(await screen.findByRole('complementary', { name: 'Pharmaco' })).toBeInTheDocument()
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-search', '') // plus d'estompage
    })

    it('flèches + Entrée choisissent un résultat au clavier', async () => {
      const user = userEvent.setup()
      await seedSearch()
      renderPage()
      await screen.findByRole('button', { name: 'nœud Pharmaco' })
      await user.keyboard('/')
      await user.keyboard('anato')
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true')
      await user.keyboard('{ArrowDown}{Enter}')
      expect(
        await screen.findByRole('complementary', { name: 'Anatomie du pied' }),
      ).toBeInTheDocument()
    })

    it('aucun résultat : message clair et rien d’estompé', async () => {
      const user = userEvent.setup()
      await seedSearch()
      renderPage()
      await screen.findByRole('button', { name: 'nœud Pharmaco' })
      await user.keyboard('/')
      await user.keyboard('zzz')
      expect(screen.getByText('Aucune tâche trouvée')).toBeInTheDocument()
      expect(screen.getByTestId('constellation-canvas')).toHaveAttribute('data-search', '')
    })

    it('le « / » tapé dans un autre champ n’ouvre pas la recherche', async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByRole('button', { name: 'Réglages d’affichage' }))
      const slider = screen.getByRole('slider')
      slider.focus()
      await user.keyboard('/')
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })
  })

  it('équivalent texte du canvas : liste des tâches (nom, pilier, statut) sélectionnable au clavier', async () => {
    const user = userEvent.setup()
    renderPage()
    const list = await screen.findByRole(
      'list',
      { name: 'Tâches de la constellation' },
      { timeout: 4000 },
    )
    const item = within(list).getByRole('button', { name: 'Réviser, Sans pilier, à faire' })
    expect(
      within(list).getByRole('button', { name: /Rédiger, Sans pilier, terminée/ }),
    ).toBeInTheDocument()

    item.focus()
    await user.keyboard('{Enter}')
    expect(
      await screen.findByRole('complementary', { name: 'Réviser' }, { timeout: 4000 }),
    ).toBeInTheDocument()
  })
})
