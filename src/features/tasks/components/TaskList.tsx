import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { PillarRecord, TaskRecord } from '@/shared/storage/db'
import type { TaskDetailsUpdate } from '@/features/tasks/useTasks'

import { TaskRow } from './TaskRow'

interface TaskListProps {
  tasks: TaskRecord[]
  activeTaskId: string | null
  onToggleDone: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
  onArchive?: (id: string) => void
  onSetActive: (id: string | null) => void
  onUpdateDetails: (id: string, update: TaskDetailsUpdate) => void
  onAddSubtask: (parentId: string, title: string) => void
  onReorder: (orderedIds: string[]) => void
  pillars?: PillarRecord[]
}

/** Un seul niveau de sous-tâches (§8) : chaque tâche de premier niveau, suivie de ses
 * enfants directs — l'ordre de chaque groupe vient de `order`, pas de leur position
 * d'origine dans ce tableau. */
function buildNestedOrder(
  order: string[],
  byId: Map<string, TaskRecord>,
): { task: TaskRecord; depth: 0 | 1 }[] {
  const topLevelIds = order.filter((id) => !byId.get(id)?.parentId)
  const result: { task: TaskRecord; depth: 0 | 1 }[] = []
  for (const id of topLevelIds) {
    const task = byId.get(id)
    if (!task) continue
    result.push({ task, depth: 0 })
    for (const childId of order) {
      if (byId.get(childId)?.parentId !== id) continue
      const child = byId.get(childId)
      if (child) result.push({ task: child, depth: 1 })
    }
  }
  return result
}

/**
 * Réorganisation par Pointer Events (unifie souris, tactile et stylet, contrairement à
 * l'API HTML5 Drag and Drop mal supportée au doigt sur Safari iPad). Pendant le
 * glisser, l'élément visé est déterminé par elementFromPoint (le pointeur étant
 * capturé sur la poignée, les autres lignes ne reçoivent plus d'évènements pointer).
 */
export function TaskList({
  tasks,
  activeTaskId,
  onToggleDone,
  onRename,
  onRemove,
  onArchive,
  onSetActive,
  onUpdateDetails,
  onAddSubtask,
  onReorder,
  pillars,
}: TaskListProps) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((task) => task.id))
  const draggingIdRef = useRef<string | null>(null)
  const orderAtDragEndRef = useRef<string[] | null>(null)

  useEffect(() => {
    if (draggingIdRef.current) return // Ne pas écraser l'ordre en cours de glisser.
    setOrder(tasks.map((task) => task.id))
  }, [tasks])

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const nestedOrder = buildNestedOrder(order, byId)

  const handleDragPointerDown = (event: ReactPointerEvent, id: string) => {
    draggingIdRef.current = id
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: ReactPointerEvent) => {
    const draggingId = draggingIdRef.current
    if (!draggingId) return
    const el = document.elementFromPoint(event.clientX, event.clientY)
    const row = el?.closest<HTMLElement>('[data-task-id]')
    const overId = row?.dataset.taskId
    if (!overId || overId === draggingId) return
    // On ne glisse jamais une tâche de premier niveau au milieu des sous-tâches d'une
    // autre, ni l'inverse : seules les tâches qui partagent le même parent (ou n'en ont
    // aucune) peuvent s'échanger.
    if ((byId.get(draggingId)?.parentId ?? null) !== (byId.get(overId)?.parentId ?? null)) return

    setOrder((prev) => {
      const from = prev.indexOf(draggingId)
      const to = prev.indexOf(overId)
      if (from === -1 || to === -1 || from === to) return prev
      const next = [...prev]
      next.splice(from, 1)
      next.splice(to, 0, draggingId)
      orderAtDragEndRef.current = next
      return next
    })
  }

  const endDrag = () => {
    if (!draggingIdRef.current) return
    draggingIdRef.current = null
    if (orderAtDragEndRef.current) {
      onReorder(orderAtDragEndRef.current)
      orderAtDragEndRef.current = null
    }
  }

  return (
    <ul
      className="flex flex-col gap-1 overflow-y-auto"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {nestedOrder.map(({ task, depth }) => (
        <TaskRow
          key={task.id}
          task={task}
          depth={depth}
          isActive={task.id === activeTaskId}
          onToggleDone={onToggleDone}
          onRename={onRename}
          onRemove={onRemove}
          onArchive={onArchive}
          pillars={pillars}
          onSetActive={onSetActive}
          onUpdateDetails={onUpdateDetails}
          onAddSubtask={onAddSubtask}
          onDragPointerDown={handleDragPointerDown}
        />
      ))}
    </ul>
  )
}
