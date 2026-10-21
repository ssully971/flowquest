import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { ToastProvider } from '@/shared/toast'

import { AmbientScreen } from './AmbientScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

function renderAmbientScreen() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <TimerSettingsProvider>
          <ClockSettingsProvider>
            <AmbientScreen />
          </ClockSettingsProvider>
        </TimerSettingsProvider>
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AmbientScreen — minuteur compact en carte Liquid Glass, reste de l’écran libre (§5.3, LOT C2)', () => {
  it('affiche le temps restant et un bouton de lecture, sans le reste de l’UI du mode Focus', async () => {
    renderAmbientScreen()

    expect(await screen.findByTestId('big-digits')).toHaveTextContent('25:00')
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
    expect(screen.queryByText('Sur quoi te concentres-tu ?')).not.toBeInTheDocument()
  })

  it('démarre et met en pause le minuteur depuis la carte compacte', async () => {
    const user = userEvent.setup()
    renderAmbientScreen()

    await screen.findByTestId('big-digits')
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })

  it('ouvre le panneau des sons d’ambiance (§12/§17/§18)', async () => {
    const user = userEvent.setup()
    renderAmbientScreen()

    await screen.findByTestId('big-digits')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sons d’ambiance' }))
    expect(await screen.findByRole('dialog', { name: 'Sons d’ambiance' })).toBeInTheDocument()
  })

  it('l’horloge suit la taille et la couleur réglées dans Réglages > Horloge', async () => {
    window.localStorage.setItem(
      'flowquest.clockSettings',
      JSON.stringify({
        format: '24h',
        size: 'huge',
        showSeconds: false,
        showGreeting: true,
        flipClock: false,
        style: 'default-bold',
        color: '#F2555A',
      }),
    )
    renderAmbientScreen()

    const digits = await screen.findByTestId('big-digits')
    expect(digits.style.color).toBe('rgb(242, 85, 90)')
  })

  it('l’horloge suit aussi le style de police réglé dans Réglages > Horloge (LOT E2)', async () => {
    window.localStorage.setItem(
      'flowquest.clockSettings',
      JSON.stringify({
        format: '24h',
        size: 'normal',
        showSeconds: false,
        showGreeting: true,
        flipClock: false,
        style: 'serif',
        color: 'auto',
      }),
    )
    renderAmbientScreen()

    const digits = await screen.findByTestId('big-digits')
    expect(digits.style.fontFamily).toContain('Georgia')
  })
})
