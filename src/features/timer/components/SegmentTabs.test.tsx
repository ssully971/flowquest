import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SegmentTabs } from './SegmentTabs'

function labelOf(tabName: string) {
  const tab = screen.getByRole('tab', { name: tabName })
  return tab.querySelector('span[aria-hidden="true"]') as HTMLElement
}

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

describe('SegmentTabs — icônes plutôt que libellés texte (LOT H2, §3)', () => {
  it('chaque onglet a un aria-label mais le texte visible est masqué par défaut, sauf pour le mode actif', () => {
    render(<SegmentTabs value="focus" onChange={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Focus' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pause courte' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Pause longue' })).toBeInTheDocument()

    expect(labelOf('Focus').className).toContain('opacity-100')
    expect(labelOf('Pause courte').className).toContain('opacity-0')
    expect(labelOf('Pause longue').className).toContain('opacity-0')
  })

  it('révèle le nom au survol (souris) d’un onglet inactif', async () => {
    const user = userEvent.setup()
    render(<SegmentTabs value="focus" onChange={vi.fn()} />)

    await user.hover(screen.getByRole('tab', { name: 'Pause courte' }))
    expect(labelOf('Pause courte').className).toContain('opacity-100')

    await user.unhover(screen.getByRole('tab', { name: 'Pause courte' }))
    expect(labelOf('Pause courte').className).toContain('opacity-0')
  })

  it('révèle le nom après un appui prolongé (tactile)', () => {
    vi.useFakeTimers()
    render(<SegmentTabs value="focus" onChange={vi.fn()} />)
    const tab = screen.getByRole('tab', { name: 'Pause longue' })

    fireEvent.touchStart(tab, { touches: [{ clientX: 0, clientY: 0 }] })
    expect(labelOf('Pause longue').className).toContain('opacity-0')

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(labelOf('Pause longue').className).toContain('opacity-100')

    fireEvent.touchEnd(tab)
    expect(labelOf('Pause longue').className).toContain('opacity-0')
    vi.useRealTimers()
  })
})
