export interface Quote {
  text: string
  author: string
}

const QUOTES: Quote[] = [{ text: 'La vie est brève, l’art est long.', author: 'Hippocrate' }]

export function getCurrentQuote(): Quote {
  return QUOTES[0]
}
