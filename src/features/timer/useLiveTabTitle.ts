import { useEffect, useRef } from 'react'

import { strings } from '@/shared/i18n'

/**
 * Titre d'onglet live façon « (24:59) Fokitsu » pendant qu'une session tourne (lot 4).
 * N'écrit document.title que quand le texte change réellement (le temps affiché passe à
 * la seconde suivante), pas à chaque tick de 250ms — reste correct même onglet en arrière-
 * plan : useTimerSnapshot continue de calculer le temps restant depuis de vrais horodatages
 * (jamais un simple compteur de ticks), donc rien à rattraper au retour sur l'onglet.
 */
export function useLiveTabTitle(label: string | null, isActive: boolean): void {
  const lastTitleRef = useRef<string | null>(null)

  useEffect(() => {
    const nextTitle =
      isActive && label !== null ? `(${label}) ${strings.app.name}` : strings.app.name
    if (lastTitleRef.current === nextTitle) return
    lastTitleRef.current = nextTitle
    document.title = nextTitle
  }, [isActive, label])

  useEffect(() => {
    return () => {
      document.title = strings.app.name
    }
  }, [])
}
