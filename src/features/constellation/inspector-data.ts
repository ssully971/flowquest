import { shiftDays, startOfDay } from '@/features/stats/compute-stats'
import type {
  FocusSessionRecord,
  PillarRecord,
  TaskLinkRecord,
  TaskRecord,
} from '@/shared/storage/db'

import type { ConstellationPeriod } from './build-graph'

const DAY_MS = 86_400_000

/** Une tâche et ses sous-tâches directes (comme build-graph : le temps des enfants remonte). */
function familyIds(taskId: string, tasks: TaskRecord[]): Set<string> {
  const ids = new Set([taskId])
  for (const task of tasks) if (task.parentId === taskId) ids.add(task.id)
  return ids
}

function periodStart(period: ConstellationPeriod, now: number): number | null {
  if (period === 'all') return null
  return now - (period === '30d' ? 30 : 90) * DAY_MS
}

export interface TaskFocusStats {
  focusSeconds: number
  sessions: number
}

/** Temps de focus total et nombre de sessions d'une tâche (sous-tâches incluses), sur la période. */
export function taskFocusStats(
  taskId: string,
  tasks: TaskRecord[],
  sessions: FocusSessionRecord[],
  period: ConstellationPeriod,
  now: number,
): TaskFocusStats {
  const family = familyIds(taskId, tasks)
  const start = periodStart(period, now)
  let focusSeconds = 0
  let count = 0
  for (const session of sessions) {
    if (session.kind !== 'focus' || !session.taskId || !family.has(session.taskId)) continue
    if (start !== null && session.startedAt < start) continue
    focusSeconds += session.actualSeconds
    count += 1
  }
  return { focusSeconds, sessions: count }
}

export interface WeekBucket {
  /** Lundi de la semaine (minuit local), epoch ms. */
  weekStart: number
  seconds: number
}

function mondayOf(timestamp: number): number {
  const day = startOfDay(timestamp)
  const weekday = new Date(day).getDay() // 0 = dimanche
  return shiftDays(day, -((weekday + 6) % 7))
}

/** Plafond de semaines affichées (« Tout » ne dessine pas des années de barres). */
export const MAX_HISTOGRAM_WEEKS = 26

/**
 * Focus par semaine (lundi → dimanche) sur la période, de la plus ancienne à la plus récente ;
 * les semaines sans focus sont présentes avec 0 (trait fin dans l'histogramme). « 30 j » donne ~5
 * semaines, « 90 j » ~13, « Tout » : depuis la première session de la tâche (26 semaines au plus).
 */
export function weeklyFocus(
  taskId: string,
  tasks: TaskRecord[],
  sessions: FocusSessionRecord[],
  period: ConstellationPeriod,
  now: number,
): WeekBucket[] {
  const family = familyIds(taskId, tasks)
  const own = sessions.filter(
    (session) => session.kind === 'focus' && session.taskId && family.has(session.taskId),
  )
  const start = periodStart(period, now)
  const firstSession = own.reduce((min, session) => Math.min(min, session.startedAt), Infinity)
  const from = start !== null ? start : Number.isFinite(firstSession) ? firstSession : now
  const firstWeek = mondayOf(from)
  const lastWeek = mondayOf(now)
  const weeks: number[] = []
  for (
    let week = lastWeek;
    week >= firstWeek && weeks.length < MAX_HISTOGRAM_WEEKS;
    week = shiftDays(week, -7)
  ) {
    weeks.unshift(week)
  }
  const buckets = new Map(weeks.map((week) => [week, 0]))
  for (const session of own) {
    if (start !== null && session.startedAt < start) continue
    const week = mondayOf(session.startedAt)
    if (buckets.has(week)) buckets.set(week, (buckets.get(week) ?? 0) + session.actualSeconds)
  }
  return weeks.map((weekStart) => ({ weekStart, seconds: buckets.get(weekStart) ?? 0 }))
}

export type LinkRowKind = 'dependsOn' | 'unlocks' | 'related'

export interface LinkRow {
  linkId: string
  kind: LinkRowKind
  otherTaskId: string
  otherTitle: string
  otherDone: boolean
  /** Pilier de l'autre tâche s'il diffère de celui de la tâche courante, sinon `null`. */
  otherPillar: { name: string; color: string } | null
}

/** Une ligne par lien de la tâche : « Dépend de », « Débloque » (les tâches qui dépendent
 * d'elle) ou « Liée à ». */
export function linkRows(
  taskId: string,
  links: TaskLinkRecord[],
  tasks: TaskRecord[],
  pillars: PillarRecord[],
): LinkRow[] {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const pillarById = new Map(pillars.map((pillar) => [pillar.id, pillar]))
  const current = byId.get(taskId)
  const rows: LinkRow[] = []
  for (const link of links) {
    if (link.fromTaskId !== taskId && link.toTaskId !== taskId) continue
    const otherId = link.fromTaskId === taskId ? link.toTaskId : link.fromTaskId
    const other = byId.get(otherId)
    if (!other) continue
    const kind: LinkRowKind =
      link.kind === 'related' ? 'related' : link.fromTaskId === taskId ? 'dependsOn' : 'unlocks'
    const otherPillar =
      other.pillarId && other.pillarId !== (current?.pillarId ?? null)
        ? pillarById.get(other.pillarId)
        : undefined
    rows.push({
      linkId: link.id,
      kind,
      otherTaskId: otherId,
      otherTitle: other.title,
      otherDone: other.done,
      otherPillar: otherPillar ? { name: otherPillar.name, color: otherPillar.color } : null,
    })
  }
  const order: Record<LinkRowKind, number> = { dependsOn: 0, unlocks: 1, related: 2 }
  return rows.sort(
    (a, b) => order[a.kind] - order[b.kind] || a.otherTitle.localeCompare(b.otherTitle),
  )
}

export type UnlockState =
  | { kind: 'none' }
  /** Toutes les dépendances sont terminées : la tâche est débloquée. */
  | { kind: 'unlocked'; doneTitles: string[] }
  /** Au moins une dépendance n'est pas terminée. */
  | { kind: 'blocked'; blockingTitles: string[] }

/** État de déblocage d'une tâche à faire d'après ses liens « dépend de ». Une tâche terminée ou
 * sans dépendance n'a pas d'encart. */
export function unlockState(
  task: TaskRecord,
  links: TaskLinkRecord[],
  tasks: TaskRecord[],
): UnlockState {
  if (task.done) return { kind: 'none' }
  const byId = new Map(tasks.map((candidate) => [candidate.id, candidate]))
  const requirements = links
    .filter((link) => link.kind === 'depends_on' && link.fromTaskId === task.id)
    .map((link) => byId.get(link.toTaskId))
    .filter((candidate): candidate is TaskRecord => Boolean(candidate))
  if (requirements.length === 0) return { kind: 'none' }
  const blocking = requirements.filter((requirement) => !requirement.done)
  if (blocking.length > 0) return { kind: 'blocked', blockingTitles: blocking.map((t) => t.title) }
  return { kind: 'unlocked', doneTitles: requirements.map((requirement) => requirement.title) }
}

export interface PillarSummary {
  tasksDone: number
  tasksTotal: number
  seconds: number
}

/** Résumé d'un pilier : tâches terminées / total (hors archivées) et temps de focus (période). */
export function pillarSummary(
  pillarKey: string | null,
  tasks: TaskRecord[],
  sessions: FocusSessionRecord[],
  period: ConstellationPeriod,
  now: number,
): PillarSummary {
  const own = tasks.filter((task) => !task.archivedAt && (task.pillarId ?? null) === pillarKey)
  const ids = new Set(own.map((task) => task.id))
  const start = periodStart(period, now)
  let seconds = 0
  for (const session of sessions) {
    if (session.kind !== 'focus' || !session.taskId || !ids.has(session.taskId)) continue
    if (start !== null && session.startedAt < start) continue
    seconds += session.actualSeconds
  }
  return {
    tasksDone: own.filter((task) => task.done).length,
    tasksTotal: own.length,
    seconds,
  }
}
