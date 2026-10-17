import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AMBIENT_SOUNDS } from '../sounds'
import type { UseAmbientSoundsResult } from '../useAmbientSounds'
import { AmbientSoundsPanel } from './AmbientSoundsPanel'

function baseProps(overrides: Partial<UseAmbientSoundsResult> = {}): UseAmbientSoundsResult {
  return {
    activeIds: [],
    volumes: {},
    canActivateMore: true,
    toggle: vi.fn(),
    setVolume: vi.fn(),
    sleepTimerMinutes: null,
    setSleepTimerMinutes: vi.fn(),
    remainingSleepMs: null,
    ...overrides,
  }
}

describe('AmbientSoundsPanel — sons d’ambiance (§12/§17/§18 du cahier des charges)', () => {
  it('ne rend rien quand il est fermé', () => {
    render(<AmbientSoundsPanel open={false} onClose={vi.fn()} {...baseProps()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('liste tous les sons du catalogue', () => {
    render(<AmbientSoundsPanel open onClose={vi.fn()} {...baseProps()} />)
    for (const sound of AMBIENT_SOUNDS) {
      expect(screen.getByRole('button', { name: sound.label })).toBeInTheDocument()
    }
  })

  it('bascule un son au clic', async () => {
    const user = userEvent.setup()
    const toggle = vi.fn()
    render(<AmbientSoundsPanel open onClose={vi.fn()} {...baseProps({ toggle })} />)

    await user.click(screen.getByRole('button', { name: AMBIENT_SOUNDS[0].label }))
    expect(toggle).toHaveBeenCalledWith(AMBIENT_SOUNDS[0].id)
  })

  it('affiche un réglage de volume seulement pour les sons actifs', () => {
    render(
      <AmbientSoundsPanel
        open
        onClose={vi.fn()}
        {...baseProps({ activeIds: [AMBIENT_SOUNDS[0].id] })}
      />,
    )
    expect(screen.getAllByRole('slider')).toHaveLength(1)
  })

  it('désactive les sons inactifs quand deux sont déjà actifs', () => {
    render(
      <AmbientSoundsPanel
        open
        onClose={vi.fn()}
        {...baseProps({
          activeIds: [AMBIENT_SOUNDS[0].id, AMBIENT_SOUNDS[1].id],
          canActivateMore: false,
        })}
      />,
    )
    expect(screen.getByRole('button', { name: AMBIENT_SOUNDS[2].label })).toBeDisabled()
    expect(screen.getByRole('button', { name: AMBIENT_SOUNDS[0].label })).toBeEnabled()
  })

  it('choisit un minuteur d’arrêt', async () => {
    const user = userEvent.setup()
    const setSleepTimerMinutes = vi.fn()
    render(
      <AmbientSoundsPanel open onClose={vi.fn()} {...baseProps({ setSleepTimerMinutes })} />,
    )

    await user.click(screen.getByRole('button', { name: '15 min' }))
    expect(setSleepTimerMinutes).toHaveBeenCalledWith(15)
  })

  it('affiche le temps restant du minuteur d’arrêt', () => {
    render(
      <AmbientSoundsPanel
        open
        onClose={vi.fn()}
        {...baseProps({ sleepTimerMinutes: 15, remainingSleepMs: 9 * 60_000 + 30_000 })}
      />,
    )
    expect(screen.getByText(/10 min/)).toBeInTheDocument()
  })
})
