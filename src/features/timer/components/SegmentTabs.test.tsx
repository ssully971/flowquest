import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SegmentTabs } from './SegmentTabs'

describe('SegmentTabs — blocage pendant une session active (LOT E5)', () => {
  it('appelle onChange au clic sur un autre onglet par défaut (non bloqué)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentTabs value="focus" onChange={onChange} />)

    await user.click(screen.getByRole('tab', { name: 'Pause courte' }))
    expect(onChange).toHaveBeenCalledWith('short_break')
  })

  it('n’appelle jamais onChange au clic quand disabled est vrai', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentTabs value="focus" onChange={onChange} disabled />)

    await user.click(screen.getByRole('tab', { name: 'Pause courte' }))
    await user.click(screen.getByRole('tab', { name: 'Pause longue' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('marque les onglets aria-disabled quand bloqués', () => {
    render(<SegmentTabs value="focus" onChange={vi.fn()} disabled />)

    for (const tab of screen.getAllByRole('tab')) {
      expect(tab).toHaveAttribute('aria-disabled', 'true')
    }
  })

  it('ignore aussi la navigation clavier quand bloqué', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<SegmentTabs value="focus" onChange={onChange} disabled />)

    screen.getByRole('tab', { name: 'Focus' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(onChange).not.toHaveBeenCalled()
  })
})
