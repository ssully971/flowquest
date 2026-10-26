import { AdminGate } from '@/features/admin/AdminGate'
import { AuthGate } from '@/features/auth/AuthGate'
import { AuthGateRequestProvider } from '@/features/auth/AuthGateRequestProvider'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { SuspensionGate } from '@/features/auth/SuspensionGate'
import { InviteCodeGate } from '@/features/invites/components/InviteCodeGate'
import { DiagnosticPage } from '@/features/diagnostic/DiagnosticPage'
import { ClockSettingsProvider } from '@/features/home/ClockSettingsProvider'
import { HomeScreen } from '@/features/home/HomeScreen'
import { QuotesSettingsProvider } from '@/features/home/QuotesSettingsProvider'
import { LegalNoticePage } from '@/features/legal/pages/LegalNoticePage'
import { PrivacyPage } from '@/features/legal/pages/PrivacyPage'
import { TermsPage } from '@/features/legal/pages/TermsPage'
import { ActiveRoomProvider } from '@/features/rooms/ActiveRoomProvider'
import { SocialInvitesBanner } from '@/features/friends/components/SocialInvitesBanner'
import { GroupSessionFab } from '@/features/rooms/components/GroupSessionFab'
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
  const isMainRoute =
    !isTermsRoute && !isPrivacyRoute && !isLegalNoticeRoute && !isDiagnosticRoute && !isAdminRoute

  // Retour à l'horloge de groupe : sur l'application, bascule en mode Focus ; depuis une autre
  // page (conditions, admin...), le mode est mémorisé puis on retourne à l'application.
  const returnToGroupClock = () => {
    setMode('focus')
    if (!isMainRoute) window.location.assign('/')
  }

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
                          <ActiveRoomProvider>
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
                                  <InviteCodeGate>
                                    <SuspensionGate>
                                      <AppShell mode={mode} onModeChange={setMode}>
                                        {mode === 'home' ? (
                                          <HomeScreen />
                                        ) : mode === 'focus' ? (
                                          <FocusScreen />
                                        ) : (
                                          <AmbientScreen />
                                        )}
                                      </AppShell>
                                    </SuspensionGate>
                                  </InviteCodeGate>
                                </AuthGate>
                              </AuthGateRequestProvider>
                            )}
                            {/* Bouton flottant « Session en cours » (LOT M3) : sur toutes les pages
                              sauf l'horloge elle-même (Focus et Ambiant l'affichent déjà). */}
                            {isMainRoute && mode !== 'home' ? null : (
                              <GroupSessionFab onReturn={returnToGroupClock} />
                            )}
                            {/* Invitations (LOT M4) : sur l'application, AppShell les affiche avec
                                les demandes d'ami ; sur les autres pages, seulement les salons. */}
                            {isMainRoute ? null : (
                              <SocialInvitesBanner onJoinedRoom={returnToGroupClock} />
                            )}
                          </ActiveRoomProvider>
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
