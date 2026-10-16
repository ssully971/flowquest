import { Check, GripVertical, Target, X } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { TaskRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

interface TaskRowProps {
  task: TaskRecord
  isActive: boolean
  onToggleDone: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
  onSetActive: (id: string | null) => void
  onDragPointerDown: (event: ReactPointerEvent, id: string) => void
}

export function TaskRow({
  task,
  isActive,
  onToggleDone,
  onRename,
  onRemove,
  onSetActive,
  onDragPointerDown,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.focus()
  }, [isEditing])

  const commitEdit = () => {
    setIsEditing(false)
    if (draftTitle.trim() && draftTitle.trim() !== task.title) {
      onRename(task.id, draftTitle)
    } else {
      setDraftTitle(task.title)
    }
  }

  return (
    <li
      data-task-id={task.id}
      className={`flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors duration-200 ${
        isActive
          ? 'border-[var(--accent)] bg-[var(--surface-2)]'
          : 'border-transparent hover:bg-[var(--surface-2)]'
      }`}
    >
      <button
        type="button"
        onPointerDown={(event) => onDragPointerDown(event, task.id)}
        aria-label={strings.tasks.dragHandle}
        className="shrink-0 cursor-grab touch-none text-[var(--muted)] active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <GripVertical size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? strings.tasks.markNotDone : strings.tasks.markDone}
        onClick={() => onToggleDone(task.id)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
          task.done
            ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]'
            : 'border-[var(--line)] text-transparent'
        }`}
      >
        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          value={draftTitle}
          aria-label={strings.tasks.editLabel}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={commitEdit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitEdit()
            if (event.key === 'Escape') {
              setDraftTitle(task.title)
              setIsEditing(false)
            }
          }}
          className="h-8 flex-1 rounded-lg border border-[var(--accent)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className={`flex-1 truncate text-left text-sm text-[var(--text)] ${task.done ? 'text-[var(--muted)] line-through' : ''}`}
        >
          {task.title}
        </button>
      )}

      <button
        type="button"
        onClick={() => onSetActive(isActive ? null : task.id)}
        aria-pressed={isActive}
        aria-label={isActive ? strings.tasks.unsetActive : strings.tasks.setActive}
        className={`shrink-0 rounded-full p-1.5 transition-colors duration-200 ${
          isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--text)]'
        }`}
      >
        <Target size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => onRemove(task.id)}
        aria-label={strings.tasks.remove}
        className="shrink-0 rounded-full p-1.5 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
      >
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </li>
  )
}
