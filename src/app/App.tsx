import { AdminGate } from '@/features/admin/AdminGate'
import { AuthGate } from '@/features/auth/AuthGate'
import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { DiagnosticPage } from '@/features/diagnostic/DiagnosticPage'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { HomeScreen } from '@/features/home/HomeScreen'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { LegalNoticePage } from '@/features/legal/pages/LegalNoticePage'
import { PrivacyPage } from '@/features/legal/pages/PrivacyPage'
import { TermsPage } from '@/features/legal/pages/TermsPage'
import { ActivePillarProvider } from '@/features/pillars/ActivePillarProvider'
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
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isAdminRoute = pathname === '/admin'
  const isDiagnosticRoute = pathname === '/diagnostic'
  // Pages légales (lot I1, §3) : URL propres, accessibles sans connexion — jamais
  // derrière AuthGate, comme /admin et /diagnostic ci-dessus.
  const isTermsRoute = pathname === '/conditions'
  const isPrivacyRoute = pathname === '/confidentialite'
  const isLegalNoticeRoute = pathname === '/mentions-legales'

  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <ActiveTaskProvider>
            <ActivePillarProvider>
              <TimerSettingsProvider>
                <ClockSettingsProvider>
                  <QuotesSettingsProvider>
                    <ExtrasSettingsProvider>
                      <BackgroundDisplaySettingsProvider>
                        <CustomBackgroundProvider>
                          {isTermsRoute ? (
                            <TermsPage />
                          ) : isPrivacyRoute ? (
                            <PrivacyPage />
                          ) : isLegalNoticeRoute ? (
                            <LegalNoticePage />
                          ) : isDiagnosticRoute ? (
                            <DiagnosticPage />
                          ) : isAdminRoute ? (
                            <AdminGate />
                          ) : (
                            <AuthGateRequestProvider>
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
                            </AuthGateRequestProvider>
                          )}
                        </CustomBackgroundProvider>
                      </BackgroundDisplaySettingsProvider>
                    </ExtrasSettingsProvider>
                  </QuotesSettingsProvider>
                </ClockSettingsProvider>
              </TimerSettingsProvider>
            </ActivePillarProvider>
          </ActiveTaskProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
