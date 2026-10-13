import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FocusScreen } from './FocusScreen'

describe('FocusScreen — ne chevauche pas la barre du bas commune sur petit écran', () => {
  it('réserve un espace bas (padding) pour ne pas chevaucher la barre commune', async () => {
    render(<FocusScreen />)
    const question = await screen.findByText('Sur quoi te concentres-tu ?')
    const root = question.closest('div[class*="flex"][class*="flex-col"]')
    expect(root?.className).toContain('pb-28')
    expect(root?.className).toContain('sm:pb-32')
  })
})
