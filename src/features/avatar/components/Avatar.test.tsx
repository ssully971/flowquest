import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from './Avatar'

describe('Avatar — composant unique réutilisé partout (LOT F1)', () => {
  it('affiche les initiales sur une couleur déduite de l’identifiant quand il n’y a pas de photo', () => {
    render(<Avatar userId="user-1" username="ssully" displayName="Sullivan Huriez" />)
    expect(screen.getByText('SH')).toBeInTheDocument()
  })

  it('jamais de case vide : retombe sur le pseudo si aucun nom affiché', () => {
    render(<Avatar userId="user-1" username="ssully" />)
    expect(screen.getByText('SS')).toBeInTheDocument()
  })

  it('affiche la photo (avec ?v= pour contourner le cache) quand avatarUrl est fourni', () => {
    render(
      <Avatar
        userId="user-1"
        username="ssully"
        avatarUrl="https://example.test/avatars/user-1/avatar.webp"
        avatarVersion={3}
      />,
    )
    const img = document.querySelector('img') as HTMLImageElement
    expect(img.src).toBe('https://example.test/avatars/user-1/avatar.webp?v=3')
  })

  it('retombe sur les initiales si l’image ne charge pas', () => {
    render(
      <Avatar
        userId="user-1"
        username="ssully"
        displayName="Sullivan Huriez"
        avatarUrl="https://example.test/broken.webp"
      />,
    )
    const img = document.querySelector('img') as HTMLImageElement
    fireEvent.error(img)
    expect(screen.getByText('SH')).toBeInTheDocument()
  })

  it('affiche un point de statut seulement si statusDotColor est fourni', () => {
    const { rerender } = render(<Avatar userId="user-1" username="ssully" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    rerender(
      <Avatar userId="user-1" username="ssully" statusDotColor="#22c55e" statusLabel="En focus" />,
    )
    expect(screen.getByRole('status', { name: 'En focus' })).toBeInTheDocument()
  })

  it('deux comptes différents reçoivent des couleurs potentiellement différentes mais toujours la même pour un même compte', () => {
    const { container: first } = render(<Avatar userId="user-1" username="a" />)
    const { container: again } = render(<Avatar userId="user-1" username="a" />)
    const colorOf = (c: HTMLElement) => (c.querySelector('span[aria-hidden]') as HTMLElement).style.backgroundColor
    expect(colorOf(first)).toBe(colorOf(again))
  })
})
