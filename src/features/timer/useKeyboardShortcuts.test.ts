import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useKeyboardShortcuts } from './useKeyboardShortcuts'

function dispatchKey(key: string, overrides: Partial<KeyboardEventInit> = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...overrides })
  target.dispatchEvent(event)
  return event
}

function baseActions() {
  return {
    onPrimary: vi.fn(),
    onNext: vi.fn(),
    onReset: vi.fn(),
    onToggleMute: vi.fn(),
    onOpenHelp: vi.fn(),
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('useKeyboardShortcuts — LOT G1', () => {
  it('Espace appelle onPrimary et empêche le défilement/double-activation', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    const event = dispatchKey(' ')

    expect(actions.onPrimary).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('N, n et flèche droite appellent onNext', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    dispatchKey('n')
    dispatchKey('N')
    dispatchKey('ArrowRight')

    expect(actions.onNext).toHaveBeenCalledTimes(3)
  })

  it('R appelle onReset, M appelle onToggleMute, ? ouvre l’aide', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    dispatchKey('r')
    dispatchKey('m')
    dispatchKey('?')

    expect(actions.onReset).toHaveBeenCalled()
    expect(actions.onToggleMute).toHaveBeenCalled()
    expect(actions.onOpenHelp).toHaveBeenCalled()
  })

  it('ignore les touches avec Ctrl/Cmd/Alt', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    dispatchKey('n', { ctrlKey: true })
    dispatchKey('n', { metaKey: true })
    dispatchKey('n', { altKey: true })

    expect(actions.onNext).not.toHaveBeenCalled()
  })

  it('ignore l’auto-répétition (event.repeat)', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    dispatchKey(' ', { repeat: true })

    expect(actions.onPrimary).not.toHaveBeenCalled()
  })

  it('ignore les touches quand le focus est dans un champ de saisie', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    const input = document.createElement('input')
    document.body.appendChild(input)
    dispatchKey(' ', {}, input)

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    dispatchKey('n', {}, textarea)

    const select = document.createElement('select')
    document.body.appendChild(select)
    dispatchKey('r', {}, select)

    const editable = document.createElement('div')
    editable.setAttribute('contenteditable', 'true')
    document.body.appendChild(editable)
    dispatchKey('m', {}, editable)

    expect(actions.onPrimary).not.toHaveBeenCalled()
    expect(actions.onNext).not.toHaveBeenCalled()
    expect(actions.onReset).not.toHaveBeenCalled()
    expect(actions.onToggleMute).not.toHaveBeenCalled()
  })

  it('ignore les touches quand une fenêtre modale (role=dialog) est ouverte', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, true))

    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    document.body.appendChild(dialog)

    dispatchKey(' ')

    expect(actions.onPrimary).not.toHaveBeenCalled()
  })

  it('ne fait rien quand enabled est faux', () => {
    const actions = baseActions()
    renderHook(() => useKeyboardShortcuts(actions, false))

    dispatchKey(' ')

    expect(actions.onPrimary).not.toHaveBeenCalled()
  })

  it('n’appelle pas une action absente (ex. onToggleMute non fourni)', () => {
    const actions = { onOpenHelp: vi.fn() }
    renderHook(() => useKeyboardShortcuts(actions, true))

    expect(() => dispatchKey('m')).not.toThrow()
  })

  it('nettoie l’écouteur au démontage', () => {
    const actions = baseActions()
    const { unmount } = renderHook(() => useKeyboardShortcuts(actions, true))

    unmount()
    dispatchKey(' ')

    expect(actions.onPrimary).not.toHaveBeenCalled()
  })

  it('utilise toujours la dernière version des actions passées', () => {
    const first = baseActions()
    const second = baseActions()
    const { rerender } = renderHook(({ actions }) => useKeyboardShortcuts(actions, true), {
      initialProps: { actions: first },
    })

    rerender({ actions: second })
    dispatchKey(' ')

    expect(first.onPrimary).not.toHaveBeenCalled()
    expect(second.onPrimary).toHaveBeenCalled()
  })
})
