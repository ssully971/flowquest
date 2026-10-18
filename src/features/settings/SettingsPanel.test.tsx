import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEFAULT_CLOCK_SETTINGS } from '@/features/home/clock-settings'
import { DEFAULT_QUOTES_SETTINGS } from '@/features/home/quotes-settings'
import { DEFAULT_BACKGROUND_DISPLAY_SETTINGS } from '@/features/settings/background-display-settings'
import { CustomBackgroundProvider } from '@/features/settings/CustomBackgroundProvider'
import { DEFAULT_EXTRAS_SETTINGS } from '@/features/settings/extras-settings'
import { DEFAULT_TIMER_SETTINGS } from '@/features/timer/timer-settings'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { CHANGELOG } from './changelog'
import { SettingsPanel } from './SettingsPanel'

function panel(open: boolean, onClose: () => void, extrasSettings = DEFAULT_EXTRAS_SETTINGS) {
  return (
    <ToastProvider>
      <ThemeProvider>
        <CustomBackgroundProvider>
          <button type="button">Déclencheur</button>
          <SettingsPanel
            open={open}
            onClose={onClose}
            mode="home"
            onModeChange={vi.fn()}
            backgroundSelection={{ home: 'horizon', focus: 'horizon', ambient: 'horizon' }}
            onBackgroundSelect={vi.fn()}
            backgroundDisplaySettings={DEFAULT_BACKGROUND_DISPLAY_SETTINGS}
            onBackgroundDisplaySettingsChange={vi.fn()}
            dailyGoalMinutes={120}
            onDailyGoalChange={vi.fn()}
            timerSettings={DEFAULT_TIMER_SETTINGS}
            onTimerSettingsChange={vi.fn()}
            clockSettings={DEFAULT_CLOCK_SETTINGS}
            onClockSettingsChange={vi.fn()}
            quotesSettings={DEFAULT_QUOTES_SETTINGS}
            onQuotesSettingsChange={vi.fn()}
            extrasSettings={extrasSettings}
            onExtrasSettingsChange={vi.fn()}
          />
        </CustomBackgroundProvider>
      </ThemeProvider>
    </ToastProvider>
  )
}

function renderPanel(open: boolean, extrasSettings = DEFAULT_EXTRAS_SETTINGS) {
  const onClose = vi.fn()
  const view = render(panel(open, onClose, extrasSettings))
  return {
    onClose,
    rerender: (nextOpen: boolean) => view.rerender(panel(nextOpen, onClose, extrasSettings)),
  }
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('SettingsPanel — ouverture et fermeture', () => {
  it('ne rend rien quand il est fermé', () => {
    renderPanel(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('s’ouvre et place le focus sur le bouton de fermeture', async () => {
    renderPanel(true)
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fermer les réglages' })).toHaveFocus()
    })
    expect(dialog).toBeInTheDocument()
  })

  it('le clic sur le fond assombri ferme le panneau', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel(true)
    await screen.findByRole('dialog')

    const scrim = document.querySelector('[style*="--scrim"]') as HTMLElement
    await user.click(scrim)
    expect(onClose).toHaveBeenCalled()
  })

  it('Échap ferme le panneau', async () => {
    const user = userEvent.setup()
    const { onClose } = renderPanel(true)
    await screen.findByRole('dialog')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('reste démonté tant que la transition de fermeture n’est pas terminée, puis disparaît', async () => {
    const { rerender } = renderPanel(true)
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' })

    rerender(false)
    // Toujours dans le DOM pendant l'animation de fermeture (ne doit pas disparaître
    // instantanément, et surtout pas avant la fin réelle de la transition).
    expect(screen.getByRole('dialog', { name: 'Réglages' })).toBeInTheDocument()

    fireEvent.transitionEnd(dialog)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Réglages' })).not.toBeInTheDocument()
    })
  })

  it('une réouverture pendant l’animation de fermeture ne referme pas le panneau qui vient de se rouvrir (non-régression)', async () => {
    const { rerender } = renderPanel(true)
    const dialog = await screen.findByRole('dialog', { name: 'Réglages' })

    rerender(false)
    rerender(true)

    // L'évènement de fin de transition de l'ANCIENNE fermeture (dont le panneau n'est
    // plus censé tenir compte puisqu'il a été rouvert entre-temps) ne doit jamais faire
    // disparaître le panneau rouvert.
    fireEvent.transitionEnd(dialog)
    expect(screen.getByRole('dialog', { name: 'Réglages' })).toBeInTheDocument()
  })
})

describe('SettingsPanel — piège de focus clavier', () => {
  it('Tab ne sort jamais du panneau tant qu’il est ouvert', async () => {
    const user = userEvent.setup()
    renderPanel(true)
    await screen.findByRole('dialog')

    for (let i = 0; i < 20; i++) {
      await user.tab()
    }

    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('Shift+Tab depuis le premier élément revient sur le dernier', async () => {
    const user = userEvent.setup()
    renderPanel(true)
    const dialog = await screen.findByRole('dialog')

    // Attend que le focus initial (bouton de fermeture) se soit posé avant de
    // le redéplacer manuellement, pour éviter une course avec cet effet.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Fermer les réglages' })).toHaveFocus()
    })

    const focusable = dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    focusable[0].focus()

    await user.tab({ shift: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})

describe('SettingsPanel — onglet ouvert par défaut (§7.6 Extras)', () => {
  it('ouvre sur Thèmes par défaut quand aucun onglet par défaut n’est configuré', async () => {
    renderPanel(true)
    await screen.findByRole('dialog')
    expect(screen.getAllByText('Thèmes').length).toBeGreaterThan(0)
  })

  it('ouvre sur l’onglet configuré dans Extras', async () => {
    renderPanel(true, { ...DEFAULT_EXTRAS_SETTINGS, defaultSettingsTab: 'stats' })
    await screen.findByRole('dialog')
    expect(
      screen.getByText('Termine ta première session de focus pour voir tes statistiques ici.'),
    ).toBeInTheDocument()
  })

  it('se souvient du dernier onglet ouvert à la réouverture, plutôt que de revenir au défaut configuré (lot 2)', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPanel(true, {
      ...DEFAULT_EXTRAS_SETTINGS,
      defaultSettingsTab: 'themes',
    })
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: 'Minuteur' }))
    expect(screen.getByText('Durée de focus')).toBeInTheDocument()

    rerender(false)
    const dialog = screen.getByRole('dialog', { name: 'Réglages' })
    fireEvent.transitionEnd(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    rerender(true)
    await screen.findByRole('dialog')
    expect(screen.getByText('Durée de focus')).toBeInTheDocument()
  })

  it('le dernier onglet survit à un rechargement complet (persisté, pas seulement en mémoire)', async () => {
    window.localStorage.setItem('flowquest.settingsLastPage', 'timer')
    renderPanel(true, { ...DEFAULT_EXTRAS_SETTINGS, defaultSettingsTab: 'themes' })
    await screen.findByRole('dialog')
    expect(screen.getByText('Durée de focus')).toBeInTheDocument()
  })
})

describe('SettingsPanel — badge « nouveau » sur Nouveautés (§7.9)', () => {
  it('affiche le badge tant que la dernière entrée n’a pas été vue', async () => {
    renderPanel(true)
    await screen.findByRole('dialog')
    expect(
      screen
        .getByRole('button', { name: /Nouveautés/ })
        .querySelector('span[aria-label="Nouveau"]'),
    ).not.toBeNull()
  })

  it('masque le badge après avoir ouvert Nouveautés, et il reste masqué après réouverture', async () => {
    const user = userEvent.setup()
    const { rerender } = renderPanel(true)
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: /Nouveautés/ }))
    expect(screen.getByText(CHANGELOG[0].text)).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen
          .getByRole('button', { name: /Nouveautés/ })
          .querySelector('span[aria-label="Nouveau"]'),
      ).toBeNull()
    })

    rerender(false)
    const dialog = screen.getByRole('dialog', { name: 'Réglages' })
    fireEvent.transitionEnd(dialog)
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    rerender(true)
    await screen.findByRole('dialog')
    expect(
      screen
        .getByRole('button', { name: /Nouveautés/ })
        .querySelector('span[aria-label="Nouveau"]'),
    ).toBeNull()
  })
})
