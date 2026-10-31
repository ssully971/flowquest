import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getBackgroundDefinition } from '@/shared/design-system/backgrounds/registry'

import { ConstellationBackground } from './ConstellationBackground'

describe('ConstellationBackground', () => {
  it('est un fond décoratif en lecture seule : masqué aux lecteurs d’écran, sans interaction', () => {
    render(<ConstellationBackground />)
    const background = screen.getByTestId('constellation-background')
    expect(background).toHaveAttribute('aria-hidden', 'true')
    expect(background.className).toContain('pointer-events-none')
    expect(background.querySelector('canvas')).not.toBeNull()
  })

  it('est une entrée du registre des fonds, utilisable en mode Ambiant', () => {
    const definition = getBackgroundDefinition('constellation')
    expect(definition.id).toBe('constellation')
    expect(definition.usableInAmbient).not.toBe(false)
  })
})
