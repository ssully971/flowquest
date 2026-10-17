import { Plus, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { strings } from '@/shared/i18n'

import { useActiveTask } from '../active-task-context'
import { fireTaskListConfetti } from '../confetti'
import { useTasks } from '../useTasks'
import { TaskList } from './TaskList'

interface TasksPanelProps {
  open: boolean
  onClose: () => void
}

export function TasksPanel({ open, onClose }: TasksPanelProps) {
  const {
    tasks,
    isLoading,
    addTask,
    toggleDone,
    renameTask,
    removeTask,
    reorderTasks,
    updateTaskDetails,
  } = useTasks()
  const { activeTaskId, setActiveTaskId } = useActiveTask()
  const [newTitle, setNewTitle] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  const handleAdd = (event: FormEvent) => {
    event.preventDefault()
    void addTask(newTitle)
    setNewTitle('')
  }

  const handleRemove = (id: string) => {
    void removeTask(id)
    if (activeTaskId === id) setActiveTaskId(null)
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={strings.tasks.title}
      className="absolute bottom-full right-0 z-40 mb-3 flex max-h-[60vh] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[0_10px_24px_var(--glow)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text)]">{strings.tasks.title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={strings.tasks.close}
          className="rounded-full p-1 text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          ref={inputRef}
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          placeholder={strings.tasks.addPlaceholder}
          className="h-10 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={!newTitle.trim()}
          aria-label={strings.tasks.addButton}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
        >
          <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </form>

      {isLoading ? null : tasks.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">{strings.tasks.empty}</p>
      ) : (
        <TaskList
          tasks={tasks}
          activeTaskId={activeTaskId}
          onToggleDone={(id) => {
            void toggleDone(id).then((isLastRemaining) => {
              if (isLastRemaining) fireTaskListConfetti()
            })
          }}
          onRename={(id, title) => void renameTask(id, title)}
          onRemove={handleRemove}
          onSetActive={setActiveTaskId}
          onUpdateDetails={(id, update) => void updateTaskDetails(id, update)}
          onAddSubtask={(parentId, title) => void addTask(title, parentId)}
          onReorder={(ids) => void reorderTasks(ids)}
        />
      )}
    </div>
  )
}
