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

  if (visible.length === 0) return <p className="fq-muted text-sm">{s.archivesEmpty}</p>

  return (
    <div className="flex flex-col gap-2">
      <p className="fq-muted text-xs">{s.archivesHint}</p>
      <ul className="flex flex-col gap-1">
        {visible.map((task) => {
          const childCount = tasks.filter((child) => child.parentId === task.id).length
          return (
            <li
              key={task.id}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--pn-hover)]"
            >
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm ${task.done ? 'fq-muted line-through' : ''}`}>
                  {task.emoji ? `${task.emoji} ` : ''}
                  {task.title}
                </p>
                <p className="fq-muted text-xs">
                  {s.archivedOn} {new Date(task.archivedAt ?? 0).toLocaleDateString('fr-FR')}
                  {childCount > 0 ? ` · ${s.subtasksCount(childCount)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRestore(task.id)}
                aria-label={`${s.restore} : ${task.title}`}
                className="fq-icon-btn"
              >
                <ArchiveRestore size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                aria-label={`${s.deletePermanently} : ${task.title}`}
                className="fq-icon-btn"
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
