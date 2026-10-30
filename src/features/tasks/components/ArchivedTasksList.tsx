import { ArchiveRestore, Trash2 } from 'lucide-react'

import type { TaskRecord } from '@/shared/storage/db'
import { strings } from '@/shared/i18n'

interface ArchivedTasksListProps {
  tasks: TaskRecord[]
  onRestore: (id: string) => void
  onDelete: (id: string) => void
}

/** Liste des tâches archivées : niveau supérieur seulement, les sous-tâches archivées avec
 * leur parent sont résumées par un compteur (elles reviennent avec lui à la restauration). */
export function ArchivedTasksList({ tasks, onRestore, onDelete }: ArchivedTasksListProps) {
  const s = strings.tasks
  const ids = new Set(tasks.map((task) => task.id))
  const visible = tasks.filter((task) => !task.parentId || !ids.has(task.parentId))

  if (visible.length === 0) return <p className="text-sm text-[var(--muted)]">{s.archivesEmpty}</p>

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-[var(--muted)]">{s.archivesHint}</p>
      <ul className="flex flex-col gap-1">
        {visible.map((task) => {
          const childCount = tasks.filter((child) => child.parentId === task.id).length
          return (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-sm ${task.done ? 'text-[var(--muted)] line-through' : 'text-[var(--text)]'}`}
                >
                  {task.emoji ? `${task.emoji} ` : ''}
                  {task.title}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {s.archivedOn} {new Date(task.archivedAt ?? 0).toLocaleDateString('fr-FR')}
                  {childCount > 0 ? ` · ${s.subtasksCount(childCount)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(task.id)}
                aria-label={`${s.restore} : ${task.title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <ArchiveRestore size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                aria-label={`${s.deletePermanently} : ${task.title}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
