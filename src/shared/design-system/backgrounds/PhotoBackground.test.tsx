import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PhotoBackground } from './PhotoBackground'

describe('PhotoBackground — fond photo plein écran (lot 3)', () => {
  it('charge l’image en "eager" par défaut (fond actif, visible immédiatement)', () => {
    const { container } = render(<PhotoBackground src="/backgrounds/scenic/fjord.webp" />)
    const img = container.querySelector('img')
    expect(img).toHaveAttribute('src', '/backgrounds/scenic/fjord.webp')
    expect(img).toHaveAttribute('loading', 'eager')
  })

  it('charge l’image en "lazy" pour une vignette de bibliothèque', () => {
    const { container } = render(
      <PhotoBackground src="/backgrounds/scenic/thumbs/fjord.webp" lazy />,
    )
    expect(container.querySelector('img')).toHaveAttribute('loading', 'lazy')
  })
})
