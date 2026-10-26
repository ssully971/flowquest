import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const channelMock = vi.fn()
const removeChannelMock = vi.fn()
const fromMock = vi.fn()

vi.mock('@/shared/supabase/client', () => ({
  isSupabaseConfigured: false,
  supabase: {
    channel: (...args: unknown[]) => channelMock(...args),
    removeChannel: (...args: unknown[]) => removeChannelMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

function Boom(): never {
  throw new Error('plantage simulé')
}

beforeEach(() => {
  window.localStorage.clear()
  channelMock.mockReset()
  removeChannelMock.mockReset()
  fromMock.mockReset()
  vi.resetModules()
})

describe('FeatureGate (lot I2, §1)', () => {
  it('affiche le contenu quand le drapeau est activé (valeur par défaut)', async () => {
    const { FeatureGate } = await import('./FeatureGate')
    render(
      <FeatureGate flag="galaxy">
        <p>Contenu de la galaxie</p>
      </FeatureGate>,
    )
    expect(screen.getByText('Contenu de la galaxie')).toBeInTheDocument()
  })

  it('n’affiche rien (ni le contenu ni une erreur) quand le drapeau est désactivé par défaut', async () => {
    const { FeatureGate } = await import('./FeatureGate')
    render(
      <FeatureGate flag="maintenance" disabledFallback={<p>Repli</p>}>
        <p>Bandeau de maintenance</p>
      </FeatureGate>,
    )
    expect(screen.queryByText('Bandeau de maintenance')).not.toBeInTheDocument()
    expect(screen.getByText('Repli')).toBeInTheDocument()
  })

  it('une fonctionnalité qui plante affiche le repli d’erreur sans faire tomber la page', async () => {
    const { FeatureGate } = await import('./FeatureGate')
    // React logge l'erreur interceptée dans la console (comportement normal d'une
    // frontière d'erreur) : on la tait pour ce test précis plutôt que de polluer la sortie.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <>
        <p>Reste de la page</p>
        <FeatureGate flag="galaxy" errorFallback={<p>Repli d’erreur</p>}>
          <Boom />
        </FeatureGate>
      </>,
    )

    expect(screen.getByText('Reste de la page')).toBeInTheDocument()
    expect(screen.getByText('Repli d’erreur')).toBeInTheDocument()

    consoleError.mockRestore()
  })
})
