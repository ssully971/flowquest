import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { ToastProvider } from '@/shared/toast'

import { FocusScreen } from './FocusScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

function renderFocusScreen() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <ActiveTaskProvider>
          <TimerSettingsProvider>
            <ClockSettingsProvider>
              <QuotesSettingsProvider>
                <ExtrasSettingsProvider>
                  <FocusScreen />
                </ExtrasSettingsProvider>
              </QuotesSettingsProvider>
            </ClockSettingsProvider>
          </TimerSettingsProvider>
        </ActiveTaskProvider>
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('FocusScreen — ne chevauche jamais la barre du bas commune et ne masque jamais la question', () => {
  it('réserve un espace bas (padding) pour ne pas chevaucher la barre commune', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi te concentres-tu ?')
    const root = question.closest('div[class*="flex"][class*="flex-col"]')
    expect(root?.className).toContain('pb-24')
    expect(root?.className).toContain('sm:pb-28')
  })

  it('le contenu est dans un conteneur défilant (overflow-y-auto), jamais tronqué sans recours', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi te concentres-tu ?')
    const scrollContainer = question.closest('div[class*="flex"][class*="flex-col"]')?.parentElement
    expect(scrollContainer?.className).toContain('overflow-y-auto')
  })

  it('utilise min-h-full (centrage sûr) plutôt que h-full+justify-center (qui tronquerait le haut)', async () => {
    renderFocusScreen()
    const question = await screen.findByText('Sur quoi te concentres-tu ?')
    const root = question.closest('div[class*="flex"][class*="flex-col"]')
    expect(root?.className).toContain('min-h-full')
  })
})

describe('FocusScreen — citation optionnelle (masquée par défaut)', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('ne montre aucune citation tant que « Afficher en mode Focus » n’est pas activé', async () => {
    renderFocusScreen()
    await screen.findByText('Sur quoi te concentres-tu ?')
    expect(document.querySelector('blockquote')).toBeNull()
  })

  it('montre une citation quand « Afficher en mode Focus » est activé', async () => {
    window.localStorage.setItem(
      'flowquest.quotesSettings',
      JSON.stringify({
        showOnHome: true,
        showOnFocus: true,
        rotation: 'daily',
        category: 'all',
      }),
    )
    renderFocusScreen()
    await screen.findByText('Sur quoi te concentres-tu ?')
    expect(document.querySelector('blockquote')).not.toBeNull()
  })
})
