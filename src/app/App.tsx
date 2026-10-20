import { AdminGate } from '@/features/admin/AdminGate'
import { AuthGate } from '@/features/auth/AuthGate'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { DiagnosticPage } from '@/features/diagnostic/DiagnosticPage'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { HomeScreen } from '@/features/home/HomeScreen'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { BackgroundDisplaySettingsProvider } from '@/features/settings/BackgroundDisplaySettingsProvider'
import { CustomBackgroundProvider } from '@/features/settings/CustomBackgroundProvider'
import { ExtrasSettingsProvider } from '@/features/settings/ExtrasSettingsProvider'
import { ActiveTaskProvider } from '@/features/tasks/ActiveTaskProvider'
import { AmbientScreen } from '@/features/timer/AmbientScreen'
import { FocusScreen } from '@/features/timer/FocusScreen'
import { TimerSettingsProvider } from '@/features/timer/TimerSettingsProvider'
import { ThemeProvider } from '@/shared/design-system'
import { ToastProvider } from '@/shared/toast'

import { AppShell } from './AppShell'
import { useAppMode } from './useAppMode'

export function App() {
  const [mode, setMode] = useAppMode()
  const isAdminRoute = typeof window !== 'undefined' && window.location.pathname === '/admin'
  const isDiagnosticRoute =
    typeof window !== 'undefined' && window.location.pathname === '/diagnostic'

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <TimerSettingsProvider>
              <ClockSettingsProvider>
                <QuotesSettingsProvider>
                  <ExtrasSettingsProvider>
                    <BackgroundDisplaySettingsProvider>
                      <CustomBackgroundProvider>
                        {isDiagnosticRoute ? (
                          <DiagnosticPage />
                        ) : isAdminRoute ? (
                          <AdminGate />
                        ) : (
                          <AuthGate>
                            <AppShell mode={mode} onModeChange={setMode}>
                              {mode === 'home' ? (
                                <HomeScreen />
                              ) : mode === 'focus' ? (
                                <FocusScreen />
                              ) : (
                                <AmbientScreen />
                              )}
                            </AppShell>
                          </AuthGate>
                        )}
                      </CustomBackgroundProvider>
                    </BackgroundDisplaySettingsProvider>
                  </ExtrasSettingsProvider>
                </QuotesSettingsProvider>
              </ClockSettingsProvider>
            </TimerSettingsProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
