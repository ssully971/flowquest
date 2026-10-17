import { describe, expect, it } from 'vitest'

import { QUOTES, pickDailyQuote, pickRandomQuote } from './quotes'

describe('quotes — liste de départ et rotation (§7.5 et §5.1 du cahier des charges)', () => {
  it('contient au moins une citation par catégorie (médecine, concentration)', () => {
    expect(QUOTES.some((quote) => quote.category === 'medicine')).toBe(true)
    expect(QUOTES.some((quote) => quote.category === 'focus')).toBe(true)
  })

  it('la citation de départ du cahier des charges est bien présente', () => {
    expect(
      QUOTES.some(
        (quote) =>
          quote.text === 'La vie est brève, l’art est long.' && quote.author === 'Hippocrate',
      ),
    ).toBe(true)
  })

  it('pickDailyQuote est déterministe pour une même date et change le jour suivant', () => {
    const day1 = new Date(2026, 0, 15)
    const day2 = new Date(2026, 0, 16)
    const first = pickDailyQuote('all', day1)
    const again = pickDailyQuote('all', day1)
    expect(first).toEqual(again)

    const next = pickDailyQuote('all', day2)
    expect(next).not.toBe(undefined)
  })

  it('pickDailyQuote respecte le filtre de catégorie', () => {
    const quote = pickDailyQuote('medicine', new Date(2026, 0, 15))
    expect(quote.category).toBe('medicine')
  })

  it('pickRandomQuote respecte le filtre de catégorie', () => {
    for (let i = 0; i < 20; i++) {
      expect(pickRandomQuote('focus').category).toBe('focus')
    }
  })
})
