import {
  Flame,
  Home,
  ListTodo,
  Maximize2,
  Minimize2,
  Moon,
  NotebookPen,
  Settings,
  Snowflake,
  Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { LOCKED_DIM_CLASS, LockedBadge } from '@/features/access/LockedBadge'
import { useFeatureAccess } from '@/features/access/useFeatureAccess'
import { GuestImportPrompt } from '@/features/auth/components/GuestImportPrompt'
import { useCurrentUserSync } from '@/features/auth/useCurrentUserSync'
import { MaintenanceBanner } from '@/features/feature-flags/MaintenanceBanner'
import { SocialPanel } from '@/features/friends/components/SocialPanel'
import { useCheers } from '@/features/friends/useCheers'
import { CheersBanner } from '@/features/friends/components/CheersBanner'
import { SocialInvitesBanner } from '@/features/friends/components/SocialInvitesBanner'
import { useDuoStreaks } from '@/features/friends/useDuoStreaks'
import { useFriends } from '@/features/friends/useFriends'
import { useLeaderboard } from '@/features/friends/useLeaderboard'
import { useLiveStatusSync } from '@/features/friends/useLiveStatusSync'
import { usePillarSync } from '@/features/pillars/usePillarSync'
import { useXpGrantNotice } from '@/features/pillars/useXpGrantNotice'
import { GameCampaignBanner } from '@/features/game-master/GameCampaignBanner'
import { InstallPrompt } from '@/features/pwa/InstallPrompt'
import { useActiveGroupRoom } from '@/features/rooms/active-room-context'
import { useClockSettings } from '@/features/home/clock-settings-context'
import { useQuotesSettings } from '@/features/home/quotes-settings-context'
import { blurPercentToPx } from '@/features/settings/background-display-settings'
import { useBackgroundDisplaySettings } from '@/features/settings/background-display-settings-context'
import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { SettingsPanel } from '@/features/settings/SettingsPanel'
import { useSettingsSync } from '@/features/settings/useSettingsSync'
import { StreakPanel } from '@/features/stats/components/StreakPanel'
import { FREEZE_STOCK_CAP } from '@/features/stats/streak-freezes'
import { useDailyGoal } from '@/features/stats/useDailyGoal'
import { useDashboardStats } from '@/features/stats/useDashboardStats'
import { useSessionSync } from '@/features/stats/useSessionSync'
import { NotesPanel } from '@/features/notes/components/NotesPanel'
import { useActiveTask } from '@/features/tasks/active-task-context'
import { TasksPanel } from '@/features/tasks/components/TasksPanel'
import { useConstellationSync } from '@/features/constellation/useConstellationSync'
import { useTaskSync } from '@/features/tasks/useTaskSync'
import { useTimerSettings } from '@/features/timer/timer-settings-context'
import {
  BACKGROUNDS,
  IconButton,
  SegmentedControl,
  getBackgroundDefinition,
  useTheme,
} from '@/shared/design-system'
import { useFullscreen } from '@/shared/hooks/useFullscreen'
import { strings } from '@/shared/i18n'

import { MobileMenu } from './MobileMenu'
import type { AppMode } from './useAppMode'
import { useBackgroundSettings } from './useBackgroundSettings'

interface AppShellProps {
  mode: AppMode
  onModeChange: (mode: AppMode) => void
  children: ReactNode
}

// Icônes (LOT H2, §5) : visibles seules sur mobile (texte en sr-only, voir
// SegmentedControl), avec le texte à côté à partir de `sm:` — inchangé sur grand écran.
const MODE_OPTIONS: { value: AppMode; label: string; icon: LucideIcon }[] = [
  { value: 'home', label: strings.common.modeHome, icon: Home },
  { value: 'focus', label: strings.common.modeFocus, icon: Timer },
  { value: 'ambient', label: strings.common.modeAmbient, icon: Moon },
]

export function AppShell({ mode, onModeChange, children }: AppShellProps) {
  const fullscreen = useFullscreen()
  const { selections, resolve, setBackground, setLinked, setBackgroundBoth, replaceSelection } =
    useBackgroundSettings()
  const { settings: backgroundDisplaySettings, setSettings: setBackgroundDisplaySettings } =
    useBackgroundDisplaySettings()
  const { appearance, setAppearance } = useTheme()
  const { activeTaskId, setActiveTaskId } = useActiveTask()
  const { dailyGoalMinutes, setDailyGoalMinutes } = useDailyGoal()
  const { settings: timerSettings, setSettings: setTimerSettings } = useTimerSettings()
  const { settings: clockSettings, setSettings: setClockSettings } = useClockSettings()
  const { settings: quotesSettings, setSettings: setQuotesSettings } = useQuotesSettings()
  const { settings: extrasSettings, setSettings: setExtrasSettings } = useExtrasSettings()
  const { isLocked, requireAccount } = useFeatureAccess()
  const statsLocked = isLocked('stats')
  const tasksLocked = isLocked('tasks')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isTasksOpen, setIsTasksOpen] = useState(false)
  const [isNotesOpen, setIsNotesOpen] = useState(false)
  const [isSocialOpen, setIsSocialOpen] = useState(false)
  const [isStreakOpen, setIsStreakOpen] = useState(false)
  const [previousMode, setPreviousMode] = useState(mode)

  // §5.3 : en mode Ambiant, le reste de l'écran doit rester libre (tâches/notes masquées).
  // Fermés en phase de rendu (plutôt que dans un effet) pour éviter qu'un panneau resté
  // ouvert ne réapparaisse dès qu'on quitte le mode Ambiant.
  if (previousMode !== mode) {
    setPreviousMode(mode)
    if (mode === 'ambient') {
      if (isTasksOpen) setIsTasksOpen(false)
      if (isNotesOpen) setIsNotesOpen(false)
      if (isStreakOpen) setIsStreakOpen(false)
      if (isSocialOpen) setIsSocialOpen(false)
    }
  }

  useCurrentUserSync()
  useLiveStatusSync()
  const cheers = useCheers()
  // Point d'entrée social unique (LOT H2, §1) : états possédés ici (plutôt que dans
  // SocialPanel) pour que la pastille de l'engrenage ci-dessous puisse les lire sans
  // ouvrir un second canal temps réel par état (useFriendsRealtime, useRoomInvitesRealtime...
  // supportent plusieurs montages, mais doubler les abonnements serait du gaspillage).
  const friendsState = useFriends()
  // Mes salons (liste + invitations) viennent du fournisseur de session de groupe (LOT M3),
  // monté une fois à la racine : battement de cœur, temps réel et horloge de groupe y vivent.
  const { roomsState } = useActiveGroupRoom()
  const leaderboardState = useLeaderboard()
  const duoStreaksState = useDuoStreaks()
  const hasUnreadSocial =
    friendsState.incomingRequests.length > 0 ||
    cheers.unreadCount > 0 ||
    roomsState.rooms.some((room) => room.myStatus === 'invited')
  useSettingsSync({
    appearance,
    setAppearance,
    backgrounds: selections,
    setBackgroundSelection: replaceSelection,
    backgroundDisplaySettings,
    setBackgroundDisplaySettings,
    activeTaskId,
    setActiveTaskId,
    dailyGoalMinutes,
    setDailyGoalMinutes,
    timerSettings,
    setTimerSettings,
    clockSettings,
    setClockSettings,
    quotesSettings,
    setQuotesSettings,
    extrasSettings,
    setExtrasSettings,
  })
  useSessionSync()
  useTaskSync()
  useConstellationSync()
  usePillarSync()
  useXpGrantNotice()
  const stats = useDashboardStats(dailyGoalMinutes)

  // §7.6 : coupe les animations (thèmes et horloge) pour les appareils lents.
  useEffect(() => {
    document.documentElement.dataset.disableAnimatedThemes = String(
      extrasSettings.disableAnimatedThemes,
    )
  }, [extrasSettings.disableAnimatedThemes])

  // §7.6 : thème aléatoire à chaque chargement de l'application (pas à chaque réglage).
  useEffect(() => {
    if (!extrasSettings.themeRandomizer) return
    const pool = extrasSettings.disableAnimatedThemes
      ? BACKGROUNDS.filter((bg) => bg.category !== 'animated')
      : BACKGROUNDS
    const randomId = () => pool[Math.floor(Math.random() * pool.length)].id
    setBackgroundBoth('home', randomId())
    setBackgroundBoth('focus', randomId())
    setBackgroundBoth('ambient', randomId())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const CurrentBackground = getBackgroundDefinition(resolve(mode)).Component
  const blurPx = blurPercentToPx(backgroundDisplaySettings.blurPercent)
  const settingsButton = (
    <span className="relative inline-flex">
      <IconButton
        icon={Settings}
        label={strings.common.settings}
        onClick={() => setIsSettingsOpen(true)}
      />
      {/* Pastille de notifications non lues (LOT H2, §1) : demande d'ami, encouragement ou
          invitation de salon — la seule indication désormais que le panneau social a
          quelque chose de nouveau, plus aucun bouton dédié en bas à droite. */}
      {hasUnreadSocial ? (
        <span
          aria-label={strings.social.unreadBadge}
          className="pointer-events-none absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2"
          style={{ background: 'var(--accent)', borderColor: 'var(--surface)' }}
        />
      ) : null}
    </span>
  )

  return (
    <div className="relative h-dvh overflow-hidden">
      <div
        className="absolute inset-0 -z-10 overflow-hidden"
        style={blurPx > 0 ? { filter: `blur(${blurPx}px)`, transform: 'scale(1.1)' } : undefined}
      >
        <CurrentBackground />
      </div>
      <div
        key={mode}
        className="absolute inset-0"
        style={{ animation: 'screen-fade-in 200ms ease-out' }}
      >
        {children}
      </div>

      <div
        className="absolute inset-x-0 bottom-0 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 px-4 sm:flex-nowrap sm:justify-between sm:px-10"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Menu mobile (retour après feu vert, LOT H2 §5) : Réglages et Plein écran
            (actions ponctuelles, sans panneau ancré à repositionner) tenaient sur une
            ligne à part sur petit écran — regroupés ici derrière un seul bouton. Série,
            sélecteur de mode, Tâches et Notes gardent leur panneau ancré à leur propre
            bouton (inchangé) : les en extraire aurait cassé leur positionnement.
            Desktop inchangé (`hidden sm:flex` sur les boutons repris dans ce menu). */}
        <MobileMenu
          items={[
            {
              key: 'settings',
              icon: Settings,
              label: strings.common.settings,
              onClick: () => setIsSettingsOpen(true),
            },
            {
              key: 'fullscreen',
              icon: fullscreen.isFullscreen ? Minimize2 : Maximize2,
              label: fullscreen.isFullscreen
                ? strings.common.exitFullscreen
                : strings.common.fullscreen,
              onClick: fullscreen.toggle,
            },
          ]}
        />

        <div data-testid="left-button-group" className="hidden items-center gap-3 sm:flex">
          {extrasSettings.settingsPanelSide === 'left' ? settingsButton : null}
          <IconButton
            icon={fullscreen.isFullscreen ? Minimize2 : Maximize2}
            label={
              fullscreen.isFullscreen ? strings.common.exitFullscreen : strings.common.fullscreen
            }
            onClick={fullscreen.toggle}
          />
        </div>

        <div
          data-testid="right-button-group"
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <div className="hidden sm:contents">
            {extrasSettings.settingsPanelSide === 'right' ? settingsButton : null}
          </div>
          {extrasSettings.showStreak ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (requireAccount('stats')) setIsStreakOpen((prev) => !prev)
                }}
                aria-expanded={statsLocked ? undefined : isStreakOpen}
                aria-label={
                  statsLocked
                    ? `${strings.common.streak}${strings.access.lockedSuffix}`
                    : `${strings.common.streak} : ${stats?.currentStreakDays ?? 0}`
                }
                className={`glass-pill relative flex h-12 items-center gap-1.5 rounded-full px-4 text-sm text-[var(--glass-icon)] transition-colors duration-200 hover:text-[var(--glass-icon-hover)] ${statsLocked ? LOCKED_DIM_CLASS : ''}`}
              >
                <Flame size={18} strokeWidth={1.75} aria-hidden="true" />
                {statsLocked ? null : <span>{stats?.currentStreakDays ?? 0}</span>}
                {!statsLocked && stats?.freezes && stats.freezes.stock > 0 ? (
                  <span
                    className="flex items-center gap-0.5 text-xs"
                    aria-label={strings.streak.freezes.stockLabel(
                      stats.freezes.stock,
                      FREEZE_STOCK_CAP,
                    )}
                  >
                    <Snowflake size={13} strokeWidth={1.75} aria-hidden="true" />
                    {stats.freezes.stock}
                  </span>
                ) : null}
                {statsLocked ? <LockedBadge /> : null}
              </button>
              {statsLocked ? null : (
                <StreakPanel
                  open={isStreakOpen}
                  onClose={() => setIsStreakOpen(false)}
                  stats={stats}
                />
              )}
            </div>
          ) : null}
          <SegmentedControl
            ariaLabel={strings.common.mode}
            value={mode}
            onChange={onModeChange}
            options={MODE_OPTIONS}
            iconSize={extrasSettings.iconSize}
            variant="glass"
          />
          {mode !== 'ambient' ? (
            <div className="relative">
              <IconButton
                icon={ListTodo}
                label={
                  tasksLocked
                    ? `${strings.common.tasks}${strings.access.lockedSuffix}`
                    : strings.common.tasks
                }
                aria-expanded={tasksLocked ? undefined : isTasksOpen}
                className={tasksLocked ? LOCKED_DIM_CLASS : ''}
                onClick={() => {
                  if (requireAccount('tasks')) setIsTasksOpen((prev) => !prev)
                }}
              />
              {tasksLocked ? <LockedBadge /> : null}
              {tasksLocked ? null : (
                <TasksPanel open={isTasksOpen} onClose={() => setIsTasksOpen(false)} />
              )}
            </div>
          ) : null}
          {mode !== 'ambient' ? (
            <div className="relative">
              <IconButton
                icon={NotebookPen}
                label={strings.common.notes}
                aria-expanded={isNotesOpen}
                onClick={() => setIsNotesOpen((prev) => !prev)}
              />
              <NotesPanel open={isNotesOpen} onClose={() => setIsNotesOpen(false)} />
            </div>
          ) : null}
        </div>
      </div>

      <SocialPanel
        open={isSocialOpen}
        onClose={() => setIsSocialOpen(false)}
        onOpenRoom={() => {
          // La session de groupe prend la place de l'horloge solo : on y va directement.
          setIsSocialOpen(false)
          onModeChange('focus')
        }}
        friendsState={friendsState}
        leaderboardState={leaderboardState}
        duoStreaksState={duoStreaksState}
        roomsState={roomsState}
      />

      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onOpenSocial={() => {
          setIsSettingsOpen(false)
          setIsSocialOpen(true)
        }}
        mode={mode}
        onModeChange={onModeChange}
        backgroundSelections={selections}
        onBackgroundSelect={setBackground}
        onBackgroundLinkedChange={setLinked}
        backgroundDisplaySettings={backgroundDisplaySettings}
        onBackgroundDisplaySettingsChange={setBackgroundDisplaySettings}
        dailyGoalMinutes={dailyGoalMinutes}
        onDailyGoalChange={setDailyGoalMinutes}
        timerSettings={timerSettings}
        onTimerSettingsChange={setTimerSettings}
        clockSettings={clockSettings}
        onClockSettingsChange={setClockSettings}
        quotesSettings={quotesSettings}
        onQuotesSettingsChange={setQuotesSettings}
        extrasSettings={extrasSettings}
        onExtrasSettingsChange={setExtrasSettings}
      />

      <GuestImportPrompt />
      <InstallPrompt />
      <CheersBanner cheers={cheers.cheers} onDismiss={cheers.dismiss} />
      {/* Invitations à un salon et demandes d'ami entrantes (LOT M4) : visibles partout, avec
          Rejoindre / Refuser, sans ouvrir le mode amis. */}
      <SocialInvitesBanner
        friendRequests={friendsState.incomingRequests}
        onAcceptFriend={(id) => void friendsState.acceptRequest(id)}
        onDeclineFriend={(id) => void friendsState.declineRequest(id)}
        onJoinedRoom={() => onModeChange('focus')}
        suppressed={isSocialOpen}
      />
      <MaintenanceBanner />
      <GameCampaignBanner />
    </div>
  )
}
