import type { TaskLinkRecord } from '@/shared/storage/db'

export type TaskLinkKind = TaskLinkRecord['kind']

export type LinkRejection = 'self' | 'duplicate' | 'reverse-dependency'

/**
 * Forme canonique d'un lien : « lié à » est symétrique, on le stocke toujours dans l'ordre
 * croissant des identifiants (même règle que le trigger SQL task_links_guard) — A↔B et B↔A
 * sont donc le même lien.
 */
export function canonicalLink(
  fromTaskId: string,
  toTaskId: string,
  kind: TaskLinkKind,
): { fromTaskId: string; toTaskId: string; kind: TaskLinkKind } {
  if (kind === 'related' && fromTaskId > toTaskId) {
    return { fromTaskId: toTaskId, toTaskId: fromTaskId, kind }
  }
  return { fromTaskId, toTaskId, kind }
}

/** `null` si le lien peut être créé, sinon la raison du refus. Un « dépend de » dans les deux
 * sens créerait une dépendance circulaire immédiate : refusé. */
export function validateNewLink(
  existing: TaskLinkRecord[],
  fromTaskId: string,
  toTaskId: string,
  kind: TaskLinkKind,
): LinkRejection | null {
  if (fromTaskId === toTaskId) return 'self'
  const wanted = canonicalLink(fromTaskId, toTaskId, kind)
  if (
    existing.some(
      (link) =>
        link.kind === wanted.kind &&
        link.fromTaskId === wanted.fromTaskId &&
        link.toTaskId === wanted.toTaskId,
    )
  ) {
    return 'duplicate'
  }
  if (
    kind === 'depends_on' &&
    existing.some(
      (link) =>
        link.kind === 'depends_on' && link.fromTaskId === toTaskId && link.toTaskId === fromTaskId,
    )
  ) {
    return 'reverse-dependency'
  }
  return null
}
