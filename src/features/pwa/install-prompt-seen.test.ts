import { beforeEach, describe, expect, it } from 'vitest'

import { hasSeenInstallPrompt, markInstallPromptSeen } from './install-prompt-seen'

describe('install-prompt-seen — popup d’installation affichée une seule fois (§6.2)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('n’a pas encore été vue par défaut', () => {
    expect(hasSeenInstallPrompt()).toBe(false)
  })

  it('reste vue après avoir été marquée', () => {
    markInstallPromptSeen()
    expect(hasSeenInstallPrompt()).toBe(true)
  })
})
