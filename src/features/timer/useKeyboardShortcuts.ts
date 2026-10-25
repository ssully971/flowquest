import { useEffect, useRef } from 'react'

export interface KeyboardShortcutActions {
  /** Espace : lancer / mettre en pause / reprendre. */
  onPrimary?: () => void
  /** N ou flèche droite : passer à la phase suivante. */
  onNext?: () => void
  /** R : réinitialiser la phase en cours. */
  onReset?: () => void
  /** M : couper/rétablir les sons d'ambiance — absent (undefined) là où aucun son
   * d'ambiance n'est jouable (Focus), pour que la touche ne fasse simplement rien. */
  onToggleMute?: () => void
  /** ? : ouvre la fenêtre d'aide listant les raccourcis. */
  onOpenHelp: () => void
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  // `isContentEditable` n'est pas toujours fiable en environnement de test (jsdom) sans
  // mise en page réelle : l'attribut est vérifié en repli.
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Vrai si une fenêtre modale est actuellement ouverte quelque part dans l'app — tous
 * les panneaux/dialogues de l'app (FloatingPanel, GlassCard de dialogue...) portent déjà
 * `role="dialog"`, donc cette seule vérification générique suffit sans que ce hook ait à
 * connaître chaque panneau un par un. */
function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null
}

/**
 * Raccourcis clavier du minuteur (LOT G1) : un seul écouteur `keydown` global par écran
 * qui les utilise (Focus, Ambiant — chacun passe ses propres actions, voir
 * FocusScreen/AmbientScreen), jamais de nouvelle instance du moteur. Inactifs quand le
 * focus est dans un champ de saisie, une fenêtre modale est ouverte, une touche de
 * modificateur (Ctrl/Cmd/Alt) est enfoncée, ou en auto-répétition (`event.repeat`).
 * Espace reçoit un `preventDefault` ciblé (ni défilement de page, ni double activation
 * d'un bouton qui a le focus) — les autres touches n'en ont pas besoin.
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions, enabled: boolean): void {
  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      if (isModalOpen()) return

      switch (event.key) {
        case ' ':
          event.preventDefault()
          actionsRef.current.onPrimary?.()
          break
        case 'n':
        case 'N':
        case 'ArrowRight':
          actionsRef.current.onNext?.()
          break
        case 'r':
        case 'R':
          actionsRef.current.onReset?.()
          break
        case 'm':
        case 'M':
          actionsRef.current.onToggleMute?.()
          break
        case '?':
          actionsRef.current.onOpenHelp()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled])
}
