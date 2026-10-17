import { useCallback, useEffect, useRef, useState } from 'react'

import { hasSeenInstallPrompt, markInstallPromptSeen } from './install-prompt-seen'
import { isIOSDevice, isStandaloneDisplayMode } from './platform'

const IOS_DISPLAY_DELAY_MS = 4000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export interface UseInstallPromptResult {
  visible: boolean
  isIOS: boolean
  canInstallDirectly: boolean
  install: () => void
  dismiss: () => void
}

/** §6.2 du cahier des charges : popup discrète « Ajoute Flowquest à l'écran d'accueil »,
 * visible sur iOS et Android, une seule fois, avec « Plus tard ». iOS n'a pas d'API
 * d'installation (pas de `beforeinstallprompt`) : on y affiche juste les instructions. */
export function useInstallPrompt(): UseInstallPromptResult {
  const [visible, setVisible] = useState(false)
  const [canInstallDirectly, setCanInstallDirectly] = useState(false)
  const deferredEventRef = useRef<BeforeInstallPromptEvent | null>(null)
  const isIOS = isIOSDevice()

  useEffect(() => {
    if (isStandaloneDisplayMode() || hasSeenInstallPrompt()) return

    if (isIOS) {
      const timeoutId = window.setTimeout(() => setVisible(true), IOS_DISPLAY_DELAY_MS)
      return () => window.clearTimeout(timeoutId)
    }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredEventRef.current = event as BeforeInstallPromptEvent
      setCanInstallDirectly(true)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [isIOS])

  const dismiss = useCallback(() => {
    markInstallPromptSeen()
    setVisible(false)
  }, [])

  const install = useCallback(() => {
    const event = deferredEventRef.current
    if (!event) return
    void event
      .prompt()
      .then(() => event.userChoice)
      .then(() => {
        markInstallPromptSeen()
        setVisible(false)
      })
  }, [])

  return { visible, isIOS, canInstallDirectly, install, dismiss }
}
