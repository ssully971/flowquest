import { Archive, ArrowLeft, Plus } from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { FloatingPanel } from '@/shared/design-system'
import { strings } from '@/shared/i18n'
import { useToast } from '@/shared/toast'

import { useActiveTask } from '../active-task-context'
import { fireTaskListConfetti } from '../confetti'
import { useTasks } from '../useTasks'
import { ArchivedTasksList } from './ArchivedTasksList'
import { TaskList } from './TaskList'

interface TasksPanelProps {
  open: boolean
  onClose: () => void
}

export function TasksPanel({ open, onClose }: TasksPanelProps) {
  const {
    tasks,
    archivedTasks,
    archiveTask,
    archiveCompleted,
    unarchiveTask,
    isLoading,
    addTask,
    toggleDone,
    renameTask,
    removeTask,
    restoreTasks,
    reorderTasks,
    updateTaskDetails,
  } = useTasks()
  const { activeTaskId, setActiveTaskId } = useActiveTask()
  const { settings: extrasSettings } = useExtrasSettings()
  const { showToast } = useToast()
  const [newTitle, setNewTitle] = useState('')
  const [showArchives, setShowArchives] = useState(false)
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

  // Confirmation avant suppression (LOT H1, §5), réglage « confirmer avant de supprimer
  // une tâche » (activé par défaut). Désactivé : suppression immédiate, avec 5 s pour
  // annuler via le toast (restoreTasks remet exactement les mêmes enregistrements, la
  // ou les sous-tâches comprises, plutôt que d'en recréer avec de nouveaux id).
  const handleRemove = (id: string) => {
    if (extrasSettings.confirmTaskDeletion && !window.confirm(strings.tasks.confirmDelete)) return

    const removed = tasks.filter((task) => task.id === id || task.parentId === id)
    void removeTask(id)
    if (activeTaskId === id) setActiveTaskId(null)

    if (!extrasSettings.confirmTaskDeletion) {
      showToast({
        type: 'info',
        message: strings.tasks.deletedToast,
        action: { label: strings.tasks.undo, onClick: () => void restoreTasks(removed) },
      })
    }
  }

  const handleArchive = (id: string) => {
    void archiveTask(id)
    if (activeTaskId === id) setActiveTaskId(null)
    showToast({
      type: 'info',
      message: strings.tasks.archivedToast,
      action: { label: strings.tasks.undo, onClick: () => void unarchiveTask(id) },
    })
  }

  const handleArchiveCompleted = () => {
    if (activeTaskId && tasks.some((task) => task.id === activeTaskId && task.done)) {
      setActiveTaskId(null)
    }
    void archiveCompleted().then((count) => {
      if (count > 0) {
        showToast({ type: 'info', message: strings.tasks.archiveCompletedToast(count) })
      }
    })
  }

  // Suppression définitive depuis les archives : même confirmation que la suppression normale.
  const handleDeleteArchived = (id: string) => {
    if (!window.confirm(strings.tasks.confirmDelete)) return
    void removeTask(id)
  }

  const hasCompleted = tasks.some((task) => task.done)

  return (
    <FloatingPanel
      panelRef={panelRef}
      mode={extrasSettings.tasksDisplayMode}
      title={strings.tasks.title}
      closeLabel={strings.tasks.close}
      onClose={onClose}
      panelSizeClassName="max-h-[60vh] w-[min(22rem,calc(100vw-2rem))]"
      windowSizeClassName="h-[min(80vh,46rem)] w-[min(36rem,calc(100vw-2rem))]"
    >
      {showArchives ? (
        <>
          <button
            type="button"
            onClick={() => setShowArchives(false)}
            className="inline-flex h-11 items-center gap-2 self-start text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
            {strings.tasks.backToTasks}
          </button>
          <h3 className="text-sm font-semibold text-[var(--text)]">
            {strings.tasks.archivesTitle}
          </h3>
          <ArchivedTasksList
            tasks={archivedTasks}
            onRestore={(id) => {
              void unarchiveTask(id)
              showToast({ type: 'info', message: strings.tasks.restoredToast })
            }}
            onDelete={handleDeleteArchived}
          />
        </>
      ) : (
        <>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              placeholder={strings.tasks.addPlaceholder}
              className="h-11 flex-1 rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!newTitle.trim()}
              aria-label={strings.tasks.addButton}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-40"
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
              onArchive={handleArchive}
              onSetActive={setActiveTaskId}
              onUpdateDetails={(id, update) => void updateTaskDetails(id, update)}
              onAddSubtask={(parentId, title) => void addTask(title, parentId)}
              onReorder={(ids) => void reorderTasks(ids)}
            />
          )}

          <div className="flex flex-wrap items-center gap-x-4">
            {hasCompleted ? (
              <button
                type="button"
                onClick={handleArchiveCompleted}
                className="inline-flex h-11 items-center gap-2 text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <Archive size={16} strokeWidth={1.75} aria-hidden="true" />
                {strings.tasks.archiveCompleted}
              </button>
            ) : null}
            {archivedTasks.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowArchives(true)}
                className="inline-flex h-11 items-center text-sm text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                {strings.tasks.showArchives(archivedTasks.filter((task) => !task.parentId).length)}
              </button>
            ) : null}
          </div>
        </>
      )}
    </FloatingPanel>
  )
}
