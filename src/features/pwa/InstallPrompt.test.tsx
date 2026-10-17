import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { InstallPrompt } from './InstallPrompt'

const ORIGINAL_UA = window.navigator.userAgent

function setUserAgent(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function dispatchBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
  }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
}

describe('InstallPrompt — popup discrète d’ajout à l’écran d’accueil (§6.2 du cahier des charges)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')
  })

  afterEach(() => {
    setUserAgent(ORIGINAL_UA)
    vi.useRealTimers()
  })

  it('ne rend rien tant qu’aucun événement d’installation n’est reçu', () => {
    render(<InstallPrompt />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('affiche le message et le bouton Installer sur Android, puis se ferme avec Plus tard', async () => {
    const user = userEvent.setup()
    render(<InstallPrompt />)

    act(() => dispatchBeforeInstallPrompt())

    expect(
      screen.getByText('Ajoute Flowquest à l’écran d’accueil pour recevoir l’alerte de fin.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Installer' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Plus tard' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('affiche les instructions iOS sans bouton Installer, après un court délai', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    vi.useFakeTimers()
    render(<InstallPrompt />)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.getByText('Appuie sur Partager, puis « Sur l’écran d’accueil ».')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Installer' })).not.toBeInTheDocument()
  })
})
