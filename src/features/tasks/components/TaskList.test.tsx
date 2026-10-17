import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskRecord } from '@/shared/storage/db'

import { TaskList } from './TaskList'

function makeTask(
  id: string,
  title: string,
  position: number,
  parentId: string | null = null,
): TaskRecord {
  return {
    id,
    title,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId,
    position,
    done: false,
    doneAt: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('TaskList — réordonner au doigt et à la souris (Pointer Events, unifié)', () => {
  it('déplace une tâche par-dessus une autre et notifie le nouvel ordre au relâchement', () => {
    const tasks = [
      makeTask('a', 'Première', 0),
      makeTask('b', 'Deuxième', 1),
      makeTask('c', 'Troisième', 2),
    ]
    const onReorder = vi.fn()

    render(
      <TaskList
        tasks={tasks}
        activeTaskId={null}
        onToggleDone={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        onSetActive={vi.fn()}
        onUpdateDetails={vi.fn()}
        onAddSubtask={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const handleA = screen.getAllByRole('button', { name: 'Réordonner (glisser)' })[0]
    const rowC = screen.getByText('Troisième').closest('[data-task-id="c"]') as HTMLElement

    document.elementFromPoint = vi.fn().mockReturnValue(rowC)
    // setPointerCapture n'existe pas sur les éléments jsdom par défaut.
    ;(handleA as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn()

    fireEvent.pointerDown(handleA, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(handleA, { pointerId: 1, clientX: 0, clientY: 100 })
    fireEvent.pointerUp(handleA, { pointerId: 1 })

    expect(onReorder).toHaveBeenCalledWith(['b', 'c', 'a'])
  })

  it("ne fait rien si le pointeur n'est au-dessus d'aucune ligne (hors liste)", () => {
    const tasks = [makeTask('a', 'Première', 0), makeTask('b', 'Deuxième', 1)]
    const onReorder = vi.fn()

    render(
      <TaskList
        tasks={tasks}
        activeTaskId={null}
        onToggleDone={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        onSetActive={vi.fn()}
        onUpdateDetails={vi.fn()}
        onAddSubtask={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const handleA = screen.getAllByRole('button', { name: 'Réordonner (glisser)' })[0]
    document.elementFromPoint = vi.fn().mockReturnValue(null)
    ;(handleA as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn()

    fireEvent.pointerDown(handleA, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(handleA, { pointerId: 1, clientX: 0, clientY: 9999 })
    fireEvent.pointerUp(handleA, { pointerId: 1 })

    expect(onReorder).not.toHaveBeenCalled()
  })
})

describe('TaskList — sous-tâches (lot 6, §8)', () => {
  it('affiche chaque sous-tâche juste après son parent, même non adjacente dans le tableau reçu', () => {
    const tasks = [
      makeTask('parent', 'Tâche parente', 0),
      makeTask('other', 'Autre tâche', 1),
      makeTask('child', 'Sous-tâche', 0, 'parent'),
    ]

    render(
      <TaskList
        tasks={tasks}
        activeTaskId={null}
        onToggleDone={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        onSetActive={vi.fn()}
        onUpdateDetails={vi.fn()}
        onAddSubtask={vi.fn()}
        onReorder={vi.fn()}
      />,
    )

    const titles = screen.getAllByRole('button', { name: /Tâche parente|Sous-tâche|Autre tâche/ })
    expect(titles.map((el) => el.textContent)).toEqual(['Tâche parente', 'Sous-tâche', 'Autre tâche'])
  })

  it('ne permet pas de glisser une sous-tâche au-dessus d’une tâche de premier niveau', () => {
    const tasks = [
      makeTask('parent', 'Parent', 0),
      makeTask('child', 'Enfant', 0, 'parent'),
      makeTask('other', 'Autre', 1),
    ]
    const onReorder = vi.fn()

    render(
      <TaskList
        tasks={tasks}
        activeTaskId={null}
        onToggleDone={vi.fn()}
        onRename={vi.fn()}
        onRemove={vi.fn()}
        onSetActive={vi.fn()}
        onUpdateDetails={vi.fn()}
        onAddSubtask={vi.fn()}
        onReorder={onReorder}
      />,
    )

    const childHandle = screen.getAllByRole('button', { name: 'Réordonner (glisser)' })[1]
    const rowOther = screen.getByText('Autre').closest('[data-task-id="other"]') as HTMLElement

    document.elementFromPoint = vi.fn().mockReturnValue(rowOther)
    ;(childHandle as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn()

    fireEvent.pointerDown(childHandle, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(childHandle, { pointerId: 1, clientX: 0, clientY: 100 })
    fireEvent.pointerUp(childHandle, { pointerId: 1 })

    expect(onReorder).not.toHaveBeenCalled()
  })
})
