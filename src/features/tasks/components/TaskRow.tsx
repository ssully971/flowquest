import { Check, ChevronDown, ChevronRight, GripVertical, Target, X } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { TaskRecord } from '@/shared/storage/db'
import type { TaskDetailsUpdate } from '@/features/tasks/useTasks'
import { strings } from '@/shared/i18n'

import { TASK_COLORS } from '../task-color'
import { TASK_EMOJIS } from '../task-emoji'

interface TaskRowProps {
  task: TaskRecord
  isActive: boolean
  onToggleDone: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
  onSetActive: (id: string | null) => void
  onUpdateDetails: (id: string, update: TaskDetailsUpdate) => void
  onDragPointerDown: (event: ReactPointerEvent, id: string) => void
}

function TaskDetailsEditor({
  task,
  onUpdateDetails,
}: {
  task: TaskRecord
  onUpdateDetails: (update: TaskDetailsUpdate) => void
}) {
  const s = strings.tasks

  return (
    <div className="ml-7 mt-2 flex flex-col gap-2 border-l border-[var(--line)] pl-3">
      <div>
        <p className="mb-1 text-xs text-[var(--muted)]">{s.emojiLabel}</p>
        <div className="flex flex-wrap gap-1">
          {TASK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={task.emoji === emoji}
              aria-label={emoji}
              onClick={() => onUpdateDetails({ emoji: task.emoji === emoji ? null : emoji })}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm transition-colors duration-200 ${
                task.emoji === emoji ? 'bg-[var(--accent)]' : 'hover:bg-[var(--surface-2)]'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-[var(--muted)]">{s.colorLabel}</p>
        <div className="flex flex-wrap gap-1.5">
          {TASK_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={task.color === color}
              aria-label={color}
              onClick={() => onUpdateDetails({ color: task.color === color ? null : color })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
              style={{
                background: color,
                outline: task.color === color ? '2px solid var(--text)' : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">{s.etaLabel}</label>
        <input
          type="number"
          min={0}
          max={600}
          step={5}
          value={task.etaMinutes ?? ''}
          placeholder={s.etaPlaceholder}
          onChange={(event) => {
            const value = event.target.value
            onUpdateDetails({ etaMinutes: value === '' ? null : Math.max(0, Number(value)) })
          }}
          className="h-8 w-28 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
        />
      </div>
    </div>
  )
}

export function TaskRow({
  task,
  isActive,
  onToggleDone,
  onRename,
  onRemove,
  onSetActive,
  onUpdateDetails,
  onDragPointerDown,
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [detailsOpen, setDetailsOpen] = useState(false)
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
    <li data-task-id={task.id}>
      <div
        className={`flex items-center gap-2 rounded-xl border px-2 py-2 transition-colors duration-200 ${
          isActive
            ? 'border-[var(--accent)] bg-[var(--surface-2)]'
            : 'border-transparent hover:bg-[var(--surface-2)]'
        }`}
        style={task.color ? { boxShadow: `inset 3px 0 0 ${task.color}` } : undefined}
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

        {task.emoji ? <span className="shrink-0 text-sm">{task.emoji}</span> : null}

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

        {task.etaMinutes !== null ? (
          <span className="shrink-0 text-xs text-[var(--muted)]">{task.etaMinutes} min</span>
        ) : null}

        <button
          type="button"
          onClick={() => setDetailsOpen((prev) => !prev)}
          aria-expanded={detailsOpen}
          aria-label={strings.tasks.options}
          className="shrink-0 rounded-full p-1.5 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          {detailsOpen ? (
            <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>

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
      </div>

      {detailsOpen ? (
        <TaskDetailsEditor
          task={task}
          onUpdateDetails={(update) => onUpdateDetails(task.id, update)}
        />
      ) : null}
    </li>
  )
}
