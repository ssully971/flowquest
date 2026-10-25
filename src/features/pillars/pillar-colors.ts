import { TASK_COLORS } from '@/features/tasks/task-color'

/** Même palette que les étiquettes de tâches (cohérence visuelle du contenu utilisateur,
 * voir task-color.ts) — réexportée ici sous son propre nom pour que les piliers restent
 * indépendants si cette palette devait un jour diverger. */
export const PILLAR_COLORS = TASK_COLORS
