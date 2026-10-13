import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '@/app/App'
import { ThemeProvider } from '@/shared/design-system'

import '@/styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
