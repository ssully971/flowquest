import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { TaskRecord } from '@/shared/storage/db'
import type { TaskDetailsUpdate } from '@/features/tasks/useTasks'

import { TaskRow } from './TaskRow'

interface TaskListProps {
  tasks: TaskRecord[]
  activeTaskId: string | null
  onToggleDone: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
  onSetActive: (id: string | null) => void
  onUpdateDetails: (id: string, update: TaskDetailsUpdate) => void
  onReorder: (orderedIds: string[]) => void
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
  onSetActive,
  onUpdateDetails,
  onReorder,
}: TaskListProps) {
  const [order, setOrder] = useState<string[]>(() => tasks.map((task) => task.id))
  const draggingIdRef = useRef<string | null>(null)
  const orderAtDragEndRef = useRef<string[] | null>(null)

  useEffect(() => {
    if (draggingIdRef.current) return // Ne pas écraser l'ordre en cours de glisser.
    setOrder(tasks.map((task) => task.id))
  }, [tasks])

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const orderedTasks = order.map((id) => byId.get(id)).filter((task): task is TaskRecord => !!task)

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
      {orderedTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isActive={task.id === activeTaskId}
          onToggleDone={onToggleDone}
          onRename={onRename}
          onRemove={onRemove}
          onSetActive={onSetActive}
          onUpdateDetails={onUpdateDetails}
          onDragPointerDown={handleDragPointerDown}
        />
      ))}
    </ul>
  )
}
