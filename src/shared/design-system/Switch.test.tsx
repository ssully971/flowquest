import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Switch } from './Switch'

describe('Switch — interrupteur accessible unifié (lot 2)', () => {
  it('expose role="switch" et aria-checked reflétant l’état', () => {
    render(<Switch checked label="Son" onChange={vi.fn()} />)
    const toggle = screen.getByRole('switch', { name: 'Son' })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
  })

  it('appelle onChange au clic', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} label="Son" onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Son' }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('le curseur ne dépasse jamais la piste (désactivé : 4px, activé : 24px, piste de 48px, curseur de 20px)', () => {
    const { rerender } = render(<Switch checked={false} label="Son" onChange={vi.fn()} />)
    let thumb = screen.getByRole('switch', { name: 'Son' }).querySelector('span')
    expect(thumb?.className).toContain('translate-x-1')

    rerender(<Switch checked label="Son" onChange={vi.fn()} />)
    thumb = screen.getByRole('switch', { name: 'Son' }).querySelector('span')
    expect(thumb?.className).toContain('translate-x-6')
  })
})
