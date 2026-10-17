import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '@/features/auth/AuthProvider'
import { ToastProvider } from '@/shared/toast'

import { AmbientScreen } from './AmbientScreen'
import { TimerSettingsProvider } from './TimerSettingsProvider'

vi.mock('@/shared/supabase/client', () => ({ isSupabaseConfigured: false, supabase: null }))

function renderAmbientScreen() {
  return render(
    <ToastProvider>
      <AuthProvider>
        <TimerSettingsProvider>
          <AmbientScreen />
        </TimerSettingsProvider>
      </AuthProvider>
    </ToastProvider>,
  )
}

describe('AmbientScreen — minuteur compact en carte, reste de l’écran libre (§5.3)', () => {
  it('affiche le temps restant et un bouton de lecture, sans le reste de l’UI du mode Focus', async () => {
    renderAmbientScreen()

    expect(await screen.findByText('25:00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Démarrer' })).toBeInTheDocument()
    expect(screen.queryByText('Sur quoi te concentres-tu ?')).not.toBeInTheDocument()
  })

  it('démarre et met en pause le minuteur depuis la carte compacte', async () => {
    const user = userEvent.setup()
    renderAmbientScreen()

    await screen.findByText('25:00')
    await user.click(screen.getByRole('button', { name: 'Démarrer' }))

    expect(await screen.findByRole('button', { name: 'Mettre en pause' })).toBeInTheDocument()
  })
})
