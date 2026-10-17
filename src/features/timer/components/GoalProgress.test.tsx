import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GoalProgress } from './GoalProgress'

describe('GoalProgress', () => {
  it('affiche la progression au pluriel', () => {
    render(<GoalProgress completed={2} target={4} />)
    expect(screen.getByText('Objectif : 2/4 sessions')).toBeInTheDocument()
  })

  it('accorde au singulier quand la cible est une seule session', () => {
    render(<GoalProgress completed={0} target={1} />)
    expect(screen.getByText('Objectif : 0/1 session')).toBeInTheDocument()
  })
})
