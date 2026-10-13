import { AuthProvider } from '@/features/auth/AuthProvider'
import { HomeScreen } from '@/features/home/HomeScreen'
import { FocusScreen } from '@/features/timer/FocusScreen'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'
import { useAppMode } from './useAppMode'

export function App() {
  const [mode, setMode] = useAppMode()

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppShell mode={mode} onModeChange={setMode}>
            {mode === 'home' ? <HomeScreen /> : <FocusScreen />}
          </AppShell>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
