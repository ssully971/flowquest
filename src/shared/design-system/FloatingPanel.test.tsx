import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FloatingPanel } from './FloatingPanel'

function renderPanel(mode: 'panel' | 'window') {
  const ref = createRef<HTMLDivElement>()
  const utils = render(
    <FloatingPanel
      panelRef={ref}
      mode={mode}
      title="Tâches"
      closeLabel="Fermer"
      onClose={vi.fn()}
      panelSizeClassName="w-[22rem]"
      windowSizeClassName="w-[36rem]"
    >
      <p>Contenu</p>
    </FloatingPanel>,
  )
  return { ...utils, ref }
}

describe('FloatingPanel — chrome partagé « petit panneau » / « grande fenêtre » (LOT B11)', () => {
  it('mode panel : ancré, sans fond flouté ni superposition plein écran', () => {
    renderPanel('panel')
    const dialog = screen.getByRole('dialog', { name: 'Tâches' })
    expect(dialog.className).toContain('absolute')
    expect(dialog.className).toContain('bottom-full')
    expect(dialog.className).toContain('w-[22rem]')
  })

  it('mode window : superposition plein écran centrée avec fond flouté', () => {
    const { container } = renderPanel('window')
    const dialog = screen.getByRole('dialog', { name: 'Tâches' })
    expect(dialog.className).toContain('glass-panel')
    expect(dialog.className).toContain('w-[36rem]')

    const overlay = container.querySelector('.fixed.inset-0')
    expect(overlay).not.toBeNull()
  })

  it('attache panelRef au nœud du dialogue, dans les deux modes', () => {
    const { ref: panelRef } = renderPanel('panel')
    expect(panelRef.current).toBe(screen.getByRole('dialog'))

    const { ref: windowRef } = renderPanel('window')
    expect(windowRef.current).toBe(screen.getAllByRole('dialog')[1])
  })

  it('affiche le titre et ferme au clic sur le bouton de fermeture', () => {
    renderPanel('panel')
    expect(screen.getByText('Tâches')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeInTheDocument()
    expect(screen.getByText('Contenu')).toBeInTheDocument()
  })
})
