import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'

import { TimerControls } from './TimerControls'

function renderControls(props: Partial<Parameters<typeof TimerControls>[0]> = {}) {
  return render(
    <ExtrasSettingsProvider>
      <TimerControls
        status="idle"
        onReset={vi.fn()}
        onPrimary={vi.fn()}
        onSkip={vi.fn()}
        onPictureInPicture={vi.fn()}
        pipAvailable
        {...props}
      />
    </ExtrasSettingsProvider>,
  )
}

describe('TimerControls — compact sur mobile tant que rien n’a démarré (LOT H2, §5)', () => {
  it('à l’arrêt : Passer/Terminer/PIP restent dans le DOM mais masqués sur mobile (révélés à partir de `sm:`)', () => {
    renderControls({ status: 'idle', showEndSession: true, onEndSession: vi.fn() })

    // IconButton se rend lui-même dans un `<span class="group/icon-btn ...">` (LOT H2,
    // §4, infobulle) : le wrapper qui masque sur mobile est donc le grand-parent du
    // bouton, pas son parent direct.
    const skipWrapper = screen.getByRole('button', { name: 'Passer' }).parentElement?.parentElement
    expect(skipWrapper?.className).toContain('hidden')
    expect(skipWrapper?.className).toContain('sm:block')

    const endWrapper = screen.getByRole('button', { name: 'Terminer' }).parentElement?.parentElement
    expect(endWrapper?.className).toContain('hidden')
  })

  it('une fois en cours, Passer/Terminer/PIP ne sont plus masqués', () => {
    renderControls({ status: 'running', showEndSession: true, onEndSession: vi.fn() })

    const skipWrapper = screen.getByRole('button', { name: 'Passer' }).parentElement?.parentElement
    expect(skipWrapper?.className ?? '').not.toContain('hidden')
  })

  it('Réinitialiser et le bouton principal restent toujours visibles, même à l’arrêt', () => {
    renderControls({ status: 'idle' })

    expect(screen.getByRole('button', { name: 'Réinitialiser' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Lancer' })).toBeVisible()
  })
})
