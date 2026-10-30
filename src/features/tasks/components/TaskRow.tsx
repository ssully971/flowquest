import {
  Archive,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Target,
  Trash2,
} from 'lucide-react'
import type { CSSProperties, FormEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import type { PillarRecord, TaskRecord } from '@/shared/storage/db'
import type { TaskDetailsUpdate } from '@/features/tasks/useTasks'
import { strings } from '@/shared/i18n'

import { readableOn } from '../task-accent'
import { TASK_COLORS } from '../task-color'
import { TASK_EMOJIS } from '../task-emoji'

interface TaskRowProps {
  task: TaskRecord
  depth: 0 | 1
  isActive: boolean
  onToggleDone: (id: string) => void
  onRename: (id: string, title: string) => void
  onRemove: (id: string) => void
  onArchive?: (id: string) => void
  onSetActive: (id: string | null) => void
  onUpdateDetails: (id: string, update: TaskDetailsUpdate) => void
  onAddSubtask: (parentId: string, title: string) => void
  onDragPointerDown: (event: ReactPointerEvent, id: string) => void
  /** Piliers proposés pour rattacher la tâche ; vide = fonction masquée. */
  pillars?: PillarRecord[]
}

function AddSubtaskForm({ onAdd }: { onAdd: (title: string) => void }) {
  const s = strings.tasks
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')

  if (!isOpen) {
    return (
      <button type="button" onClick={() => setIsOpen(true)} className="fq-link-btn self-start">
        <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
        {s.addSubtask}
      </button>
    )
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    onAdd(title)
    setTitle('')
    setIsOpen(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => {
          if (!title.trim()) setIsOpen(false)
        }}
        placeholder={s.addPlaceholder}
        className="fq-field flex-1"
      />
    </form>
  )
}

function TaskDetailsEditor({
  task,
  allowSubtasks,
  pillars,
  onUpdateDetails,
  onAddSubtask,
  onArchive,
  onRemove,
}: {
  task: TaskRecord
  allowSubtasks: boolean
  pillars: PillarRecord[]
  onUpdateDetails: (update: TaskDetailsUpdate) => void
  onAddSubtask: (title: string) => void
  onArchive?: () => void
  onRemove: () => void
}) {
  const s = strings.tasks

  return (
    <div className="ml-6 mt-1 mb-2 flex flex-col gap-3 border-l border-[var(--pn-line)] pl-3">
      {pillars.length > 0 ? (
        <div role="group" aria-label={s.pillarLabel}>
          <p className="fq-muted mb-1 text-xs">{s.pillarLabel}</p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              aria-pressed={!task.pillarId}
              onClick={() => onUpdateDetails({ pillarId: null })}
              className="fq-icon-btn !w-auto px-3 text-sm"
            >
              {s.noPillar}
            </button>
            {pillars.map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                aria-pressed={task.pillarId === pillar.id}
                onClick={() => onUpdateDetails({ pillarId: pillar.id })}
                className="fq-icon-btn !w-auto gap-2 px-3 text-sm"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: pillar.color }}
                  aria-hidden="true"
                />
                {pillar.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div>
        <p className="fq-muted mb-1 text-xs">{s.emojiLabel}</p>
        <div className="flex flex-wrap">
          {TASK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-pressed={task.emoji === emoji}
              aria-label={emoji}
              onClick={() => onUpdateDetails({ emoji: task.emoji === emoji ? null : emoji })}
              className="fq-icon-btn text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="fq-muted mb-1 text-xs">{s.colorLabel}</p>
        <div className="flex flex-wrap">
          {TASK_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-pressed={task.color === color}
              aria-label={color}
              onClick={() => onUpdateDetails({ color: task.color === color ? null : color })}
              className="fq-icon-btn"
            >
              <span
                className="block h-6 w-6 rounded-full"
                style={{
                  background: color,
                  outline: task.color === color ? '2px solid var(--pn-text)' : 'none',
                  outlineOffset: 2,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="fq-muted mb-1 block text-xs" htmlFor={`eta-${task.id}`}>
          {s.etaLabel}
        </label>
        <input
          id={`eta-${task.id}`}
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
          className="fq-field w-32"
        />
      </div>

      {allowSubtasks ? <AddSubtaskForm onAdd={onAddSubtask} /> : null}

      <div className="flex flex-wrap gap-x-4 border-t border-[var(--pn-line)] pt-1">
        {onArchive ? (
          <button type="button" onClick={onArchive} className="fq-link-btn">
            <Archive size={16} strokeWidth={1.75} aria-hidden="true" />
            {s.archive}
          </button>
        ) : null}
        <button type="button" onClick={onRemove} className="fq-link-btn">
          <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
          {s.remove}
        </button>
      </div>
    </div>
  )
}

export function TaskRow({
  task,
  depth,
  isActive,
  onToggleDone,
  onRename,
  onRemove,
  onArchive,
  onSetActive,
  onUpdateDetails,
  onAddSubtask,
  onDragPointerDown,
  pillars = [],
}: TaskRowProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(task.title)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const pillar = task.pillarId
    ? pillars.find((candidate) => candidate.id === task.pillarId)
    : undefined

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

  const rowStyle: CSSProperties & Record<string, string | number | undefined> = {
    marginLeft: depth * 20,
    boxShadow: task.color ? `inset 3px 0 0 ${task.color}` : undefined,
  }
  if (pillar) {
    rowStyle['--row-accent'] = pillar.color
    rowStyle['--row-on-accent'] = readableOn(pillar.color)
  }

  return (
    <li data-task-id={task.id}>
      <div className="fq-row" data-active={isActive} style={rowStyle}>
        <button
          type="button"
          onPointerDown={(event) => onDragPointerDown(event, task.id)}
          aria-label={strings.tasks.dragHandle}
          className="fq-muted flex h-11 w-7 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
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
          className="fq-check"
        >
          <span className="fq-check-box">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5l3.2 3.2L13 4.8" />
            </svg>
          </span>
        </button>

        {task.emoji ? <span className="shrink-0 text-base">{task.emoji}</span> : null}

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
            className="fq-field min-w-0 flex-1"
          />
        ) : (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1 text-left"
          >
            <span
              className={`line-clamp-2 text-[0.9375rem] leading-tight ${task.done ? 'fq-muted line-through' : ''}`}
            >
              {task.title}
            </span>
            {pillar || task.etaMinutes !== null ? (
              <span className="mt-0.5 flex items-center gap-2">
                {pillar ? (
                  <span className="fq-pill">
                    <i aria-hidden="true" />
                    {pillar.name}
                  </span>
                ) : null}
                {task.etaMinutes !== null ? (
                  <span className="fq-muted text-xs">{task.etaMinutes} min</span>
                ) : null}
              </span>
            ) : null}
          </button>
        )}

        <button
          type="button"
          onClick={() => onSetActive(isActive ? null : task.id)}
          aria-pressed={isActive}
          aria-label={isActive ? strings.tasks.unsetActive : strings.tasks.setActive}
          className="fq-icon-btn"
        >
          <Target size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => setDetailsOpen((prev) => !prev)}
          aria-expanded={detailsOpen}
          aria-label={strings.tasks.options}
          className="fq-icon-btn"
        >
          {detailsOpen ? (
            <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>

      {detailsOpen ? (
        <TaskDetailsEditor
          task={task}
          allowSubtasks={depth === 0}
          pillars={pillars}
          onUpdateDetails={(update) => onUpdateDetails(task.id, update)}
          onAddSubtask={(title) => onAddSubtask(task.id, title)}
          onArchive={onArchive ? () => onArchive(task.id) : undefined}
          onRemove={() => onRemove(task.id)}
        />
      ) : null}
    </li>
  )
}
