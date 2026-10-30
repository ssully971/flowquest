import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DraggableCluster } from './DraggableCluster'

const REGION = { left: 16, top: 32, width: 968, height: 600, right: 984, bottom: 632, x: 16, y: 32 }
const CLUSTER = {
  left: 784,
  top: 32,
  width: 200,
  height: 100,
  right: 984,
  bottom: 132,
  x: 784,
  y: 32,
}

function mockRects() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const testId = this.getAttribute('data-testid')
    if (testId === 'ambient-clock-region') return { ...REGION, toJSON: () => ({}) } as DOMRect
    if (testId === 'ambient-clock-cluster') return { ...CLUSTER, toJSON: () => ({}) } as DOMRect
    return {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect
  })
}

function setWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
}

function setup(positions?: Parameters<typeof DraggableCluster>[0]['positions']) {
  const onChange = vi.fn()
  render(
    <DraggableCluster positions={positions} onChange={onChange}>
      {(grip) => (
        <div>
          {grip}
          <span>Horloge</span>
        </div>
      )}
    </DraggableCluster>,
  )
  return { onChange, grip: screen.getByRole('button', { name: 'Déplacer l’horloge' }) }
}

beforeEach(() => {
  mockRects()
  setWidth(1280)
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('DraggableCluster — horloge Ambiant déplaçable', () => {
  it('emplacement par défaut : haut-droite sur grand écran, haut-centre sur mobile', () => {
    setup()
    const cluster = screen.getByTestId('ambient-clock-cluster')
    expect(cluster.style.left).toBe('100%')
    expect(cluster.style.top).toBe('0%')
    expect(cluster.style.transform).toBe('translate(-100%, -0%)')
  })

  it('mobile : position par défaut centrée', () => {
    setWidth(390)
    setup()
    expect(screen.getByTestId('ambient-clock-cluster').style.left).toBe('50%')
  })

  it('la poignée est atteignable au clavier, nommée et décrite, avec touch-action: none', () => {
    const { grip } = setup()
    expect(grip.style.touchAction).toBe('none')
    expect(grip).toHaveAccessibleDescription(/flèches du clavier/)
    grip.focus()
    expect(grip).toHaveFocus()
  })

  it('glisser la poignée déplace le bloc et mémorise la position à la fin du geste', () => {
    const { onChange, grip } = setup()
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 800, clientY: 50 })
    // Déplacement de 384 px vers la gauche et 234 px vers le bas : espace libre 768 × 500.
    fireEvent.pointerMove(grip, { pointerId: 1, clientX: 416, clientY: 284 })
    const cluster = screen.getByTestId('ambient-clock-cluster')
    expect(parseFloat(cluster.style.left)).toBeCloseTo(50, 0)
    expect(onChange).not.toHaveBeenCalled() // pas d'écriture à chaque pixel
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 416, clientY: 284 })

    expect(onChange).toHaveBeenCalledTimes(1)
    const [key, position] = onChange.mock.calls[0]
    expect(key).toBe('wide')
    expect(position.x).toBeCloseTo(0.5, 2)
    expect(position.y).toBeCloseTo(234 / 500, 2)
  })

  it('un geste qui sort de l’écran est contenu (clamp aux bords de la région)', () => {
    const { onChange, grip } = setup()
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 800, clientY: 50 })
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: -5000, clientY: 9000 })
    expect(onChange).toHaveBeenCalledWith('wide', { x: 0, y: 1 })
  })

  it('un simple clic sans déplacement ne mémorise rien ; un geste annulé non plus', () => {
    const { onChange, grip } = setup()
    fireEvent.pointerDown(grip, { pointerId: 1, button: 0, clientX: 800, clientY: 50 })
    fireEvent.pointerUp(grip, { pointerId: 1, clientX: 800, clientY: 50 })
    fireEvent.pointerDown(grip, { pointerId: 2, button: 0, clientX: 800, clientY: 50 })
    fireEvent.pointerMove(grip, { pointerId: 2, clientX: 700, clientY: 100 })
    fireEvent.pointerCancel(grip, { pointerId: 2 })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('flèches du clavier : déplacent par petits pas, sans déclencher les raccourcis du minuteur', async () => {
    const user = userEvent.setup()
    const windowKeydown = vi.fn()
    window.addEventListener('keydown', windowKeydown)
    const { onChange, grip } = setup({ compact: null, wide: { x: 0.5, y: 0.5 } })
    // Position affichée mesurée : cluster à 784/968 → l'état mesuré sert de départ.
    grip.focus()

    await user.keyboard('{ArrowLeft}')
    expect(onChange).toHaveBeenCalledTimes(1)
    const [key, position] = onChange.mock.calls[0]
    expect(key).toBe('wide')
    expect(position.x).toBeLessThan(1)
    expect(windowKeydown).not.toHaveBeenCalled() // la flèche n'atteint jamais le raccourci global « phase suivante »

    window.removeEventListener('keydown', windowKeydown)
  })

  it('double-clic sur la poignée ou touche Début : remet l’horloge à sa place', async () => {
    const user = userEvent.setup()
    const { onChange, grip } = setup({ compact: null, wide: { x: 0.2, y: 0.8 } })
    await user.dblClick(grip)
    expect(onChange).toHaveBeenLastCalledWith('wide', null)
    grip.focus()
    await user.keyboard('{Home}')
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith('wide', null)
  })

  it('utilise la position de l’écran compact sur mobile et celle de l’écran large sinon', () => {
    setWidth(390)
    const { unmount } = render(
      <DraggableCluster
        positions={{ compact: { x: 0.1, y: 0.2 }, wide: { x: 0.9, y: 0.9 } }}
        onChange={vi.fn()}
      >
        {(grip) => <div>{grip}</div>}
      </DraggableCluster>,
    )
    const cluster = screen.getByTestId('ambient-clock-cluster')
    expect(cluster.style.left).toBe('10%')
    expect(cluster.style.top).toBe('20%')
    unmount()
    setWidth(1280)
    render(
      <DraggableCluster
        positions={{ compact: { x: 0.1, y: 0.2 }, wide: { x: 0.9, y: 0.9 } }}
        onChange={vi.fn()}
      >
        {(grip) => <div>{grip}</div>}
      </DraggableCluster>,
    )
    expect(screen.getByTestId('ambient-clock-cluster').style.left).toBe('90%')
  })

  it('la région exclut les zones de sécurité et la barre du bas, sans gêner les gestes (pointer-events)', () => {
    setup()
    const region = screen.getByTestId('ambient-clock-region')
    expect(region.className).toContain('pointer-events-none')
    expect(region.className).toContain('safe-area-inset-top')
    expect(region.className).toContain('bottom-24')
    expect(screen.getByTestId('ambient-clock-cluster').className).toContain('pointer-events-auto')
  })
})
