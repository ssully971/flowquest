import { AdminGate } from '@/features/admin/AdminGate'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { HomeScreen } from '@/features/home/HomeScreen'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { FocusScreen } from '@/features/timer/FocusScreen'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'
import { useAppMode } from './useAppMode'

export function App() {
  const [mode, setMode] = useAppMode()
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname === '/admin'

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <TimerSettingsProvider>
              <ClockSettingsProvider>
                {isAdminRoute ? (
                  <AdminGate />
                ) : (
                  <AppShell mode={mode} onModeChange={setMode}>
                    {mode === 'home' ? <HomeScreen /> : <FocusScreen />}
                  </AppShell>
                )}
              </ClockSettingsProvider>
            </TimerSettingsProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
