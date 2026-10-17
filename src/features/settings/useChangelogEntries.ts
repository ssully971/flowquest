import { useEffect, useState } from 'react'

import { CHANGELOG } from './changelog'
import type { ChangelogEntry } from './changelog'
import { fetchChangelogEntries } from './changelog-db'

/**
 * Entrées de nouveautés effectives : CHANGELOG (statique) jusqu'à ce que la base réponde,
 * puis remplacé par les entrées publiées si la base en contient. Un seul chargement par
 * montage.
 */
export function useChangelogEntries(): ChangelogEntry[] {
  const [entries, setEntries] = useState<ChangelogEntry[]>(CHANGELOG)

  useEffect(() => {
    let cancelled = false
    void fetchChangelogEntries().then((result) => {
      if (!cancelled) setEntries(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return entries
}
