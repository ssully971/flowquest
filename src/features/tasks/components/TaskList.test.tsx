import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { TaskRecord } from '@/shared/storage/db'

import { TaskList } from './TaskList'

function makeTask(id: string, title: string, position: number): TaskRecord {
  return {
    id,
    title,
    emoji: null,
    color: null,
    etaMinutes: null,
    parentId: null,
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
