import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
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
              <FocusScreen />
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
