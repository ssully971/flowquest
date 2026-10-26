import { useEffect, useRef, useState } from 'react'

import { SignInPrompt } from '@/features/auth/components/SignInPrompt'
import { useAuth } from '@/features/auth/useAuth'
import { useTimerSettings } from '@/features/timer/timer-settings-context'
import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { CreateRoomForm } from '@/features/rooms/components/CreateRoomForm'
import { RoomCard } from '@/features/rooms/components/RoomCard'
import type { useRooms } from '@/features/rooms/useRooms'
import { FloatingPanel } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import type { useDuoStreaks } from '../useDuoStreaks'
import type { useFriends } from '../useFriends'
import type { useLeaderboard } from '../useLeaderboard'
import type { Friend } from '../types'
import { AddFriendForm } from './AddFriendForm'
import { FriendCard } from './FriendCard'
import { FriendRequestsList } from './FriendRequestsList'
import { LeaderboardTab } from './LeaderboardTab'
import { MyFriendCode } from './MyFriendCode'
import { ReportUserDialog } from './ReportUserDialog'

interface SocialPanelProps {
  open: boolean
  onClose: () => void
  onOpenRoom: (roomId: string) => void
  friendsState: ReturnType<typeof useFriends>
  leaderboardState: ReturnType<typeof useLeaderboard>
  duoStreaksState: ReturnType<typeof useDuoStreaks>
  roomsState: ReturnType<typeof useRooms>
}

type Tab = 'friends' | 'requests' | 'leaderboard' | 'rooms' | 'add'
type RoomsTab = 'mine' | 'create'

/**
 * Panneau social unique (LOT H2, §1) : regroupe ce qui vivait avant dans deux panneaux
 * séparés (Amis, Salons), chacun ouvert par son propre bouton en bas à droite de
 * l'accueil. Point d'entrée désormais unique : la carte profil en haut de Réglages (voir
 * ProfileCard) — les boutons Amis/Salons de la barre du bas ont disparu. Les états
 * (useFriends/useRooms/...) sont reçus en props plutôt que recréés ici : AppShell les
 * possède déjà pour calculer la pastille de l'engrenage (voir son commentaire), les
 * recréer ici ouvrirait un second canal temps réel par état pour rien.
 */
export function SocialPanel({
  open,
  onClose,
  onOpenRoom,
  friendsState,
  leaderboardState,
  duoStreaksState,
  roomsState,
}: SocialPanelProps) {
  const s = strings.social
  const sf = strings.friends
  const sr = strings.rooms
  const { status, isSupabaseConfigured, profile } = useAuth()
  const { settings: timerSettings } = useTimerSettings()
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [roomsTab, setRoomsTab] = useState<RoomsTab>('mine')
  const [reportTarget, setReportTarget] = useState<Friend | null>(null)
  const { refresh: refreshRooms } = roomsState
  // Coupe-circuits (lot I2, §1) : le classement et les salons peuvent être coupés
  // indépendamment du reste du mode Amis — leur onglet disparaît alors entièrement
  // plutôt que de rester visible mais vide.
  const leaderboardFlagEnabled = useFeatureFlag('leaderboard')
  const roomsFlagEnabled = useFeatureFlag('rooms')
  const friendsFlagEnabled = useFeatureFlag('friends')

  // Un salon invité pendant que le panneau était fermé doit apparaître dès l'ouverture
  // (trouvé via le test Playwright à deux contextes, LOT F3) — même logique que l'ancien
  // RoomsPanel autonome.
  useEffect(() => {
    if (open) void refreshRooms()
  }, [open, refreshRooms])

  if (!open) return null

  const streakByFriendId = new Map(
    duoStreaksState.streaks.map((streak) => [streak.friendId, streak]),
  )
  const requestCount = friendsState.incomingRequests.length
  const roomInviteCount = roomsState.rooms.filter((room) => room.myStatus === 'invited').length

  const handleAcceptRoom = (roomId: string) => {
    void roomsState.respond(roomId, true).then((ok) => {
      if (ok) onOpenRoom(roomId)
    })
  }

  const TABS: { value: Tab; label: string; badge?: number }[] = [
    { value: 'friends', label: sf.tabs.friends },
    { value: 'requests', label: sf.tabs.requests, badge: requestCount },
    ...(leaderboardFlagEnabled
      ? [{ value: 'leaderboard' as const, label: sf.leaderboard.tab }]
      : []),
    ...(roomsFlagEnabled
      ? [{ value: 'rooms' as const, label: s.tabs.rooms, badge: roomInviteCount }]
      : []),
    { value: 'add', label: sf.tabs.add },
  ]
  // Si l'onglet actif vient d'être coupé par l'admin pendant que ce panneau reste ouvert,
  // retombe sur « Amis » plutôt que de laisser un onglet sans entrée de navigation actif.
  if (
    (tab === 'leaderboard' && !leaderboardFlagEnabled) ||
    (tab === 'rooms' && !roomsFlagEnabled)
  ) {
    setTab('friends')
  }

  return (
    <>
      <FloatingPanel
        panelRef={panelRef}
        mode="window"
        title={s.panelTitle}
        closeLabel={s.closeLabel}
        onClose={onClose}
        panelSizeClassName="w-[24rem]"
        windowSizeClassName="w-full max-w-[36rem] max-h-[85vh]"
      >
        {!friendsFlagEnabled ? (
          <p className="max-w-sm text-sm text-[var(--muted)]">{s.featureDisabled}</p>
        ) : !isSupabaseConfigured ? (
          <p className="max-w-sm text-sm text-[var(--muted)]">{sf.signInRequired}</p>
        ) : status !== 'authenticated' ? (
          <SignInPrompt message={sf.signInRequired} ctaLabel={sf.signInCta} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div
              role="tablist"
              aria-label={s.panelTitle}
              className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-[var(--line)] p-1"
            >
              {TABS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  onClick={() => setTab(item.value)}
                  className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                    tab === item.value
                      ? 'bg-[var(--surface-2)] text-[var(--text)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {item.label}
                  {item.badge ? (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] font-semibold text-[var(--on-accent)]">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {tab === 'leaderboard' ? (
                <LeaderboardTab
                  leaderboard={leaderboardState.leaderboard}
                  isLoading={leaderboardState.isLoading}
                  loadError={leaderboardState.loadError}
                  weekOffset={leaderboardState.weekOffset}
                  onWeekOffsetChange={leaderboardState.setWeekOffset}
                  onRetry={() => void leaderboardState.refresh()}
                />
              ) : tab === 'rooms' ? (
                <div className="flex flex-col gap-4">
                  <div
                    role="tablist"
                    aria-label={s.tabs.rooms}
                    className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={roomsTab === 'mine'}
                      onClick={() => setRoomsTab('mine')}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        roomsTab === 'mine'
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      {sr.tabs.mine}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={roomsTab === 'create'}
                      onClick={() => setRoomsTab('create')}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                        roomsTab === 'create'
                          ? 'bg-[var(--surface-2)] text-[var(--text)]'
                          : 'text-[var(--muted)]'
                      }`}
                    >
                      {sr.tabs.create}
                    </button>
                  </div>

                  {roomsTab === 'create' ? (
                    <CreateRoomForm
                      defaults={{
                        focusMinutes: timerSettings.focusMinutes,
                        shortBreakMinutes: timerSettings.shortBreakMinutes,
                        longBreakMinutes: timerSettings.longBreakMinutes,
                        sessionsBeforeLongBreak: timerSettings.sessionsBeforeLongBreak,
                      }}
                      friends={friendsState.friends}
                      friendsLoading={friendsState.isLoading}
                      onCreate={roomsState.create}
                      onCreated={onOpenRoom}
                    />
                  ) : roomsState.isLoading ? (
                    <p className="text-sm text-[var(--muted)]">{sr.loading}</p>
                  ) : roomsState.loadError ? (
                    <div className="flex flex-col items-start gap-2">
                      <p role="alert" className="text-sm text-[var(--muted)]">
                        {sr.loadError}
                      </p>
                      <button
                        type="button"
                        onClick={() => void roomsState.refresh()}
                        className="h-9 rounded-xl border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)]"
                      >
                        {sr.retry}
                      </button>
                    </div>
                  ) : roomsState.rooms.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">{sr.empty}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {roomsState.rooms.map((room) => (
                        <RoomCard
                          key={room.roomId}
                          room={room}
                          onAccept={handleAcceptRoom}
                          onDecline={(roomId) => void roomsState.respond(roomId, false)}
                          onJoin={onOpenRoom}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : friendsState.isLoading ? (
                <p className="text-sm text-[var(--muted)]">{sf.loading}</p>
              ) : friendsState.loadError ? (
                <div className="flex flex-col items-start gap-2">
                  <p role="alert" className="text-sm text-[var(--muted)]">
                    {sf.loadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void friendsState.refresh()}
                    className="h-9 rounded-xl border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)]"
                  >
                    {sf.retry}
                  </button>
                </div>
              ) : tab === 'friends' ? (
                <div className="flex flex-col gap-2">
                  {friendsState.friends.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">{sf.empty.friends}</p>
                  ) : (
                    friendsState.friends.map((friend) => (
                      <FriendCard
                        key={friend.friendshipId}
                        friend={friend}
                        streak={streakByFriendId.get(friend.id)}
                        onRemove={(id) => void friendsState.unfriend(id)}
                        onBlock={(id) => void friendsState.block(id)}
                        onReport={setReportTarget}
                        onCheer={(id, emoji) => void friendsState.cheer(id, emoji)}
                      />
                    ))
                  )}
                </div>
              ) : tab === 'requests' ? (
                <FriendRequestsList
                  incoming={friendsState.incomingRequests}
                  outgoing={friendsState.outgoingRequests}
                  onAccept={(id) => void friendsState.acceptRequest(id)}
                  onDecline={(id) => void friendsState.declineRequest(id)}
                  onCancel={(id) => void friendsState.cancelRequest(id)}
                />
              ) : (
                <div className="flex flex-col gap-5">
                  {profile ? (
                    <MyFriendCode
                      code={profile.friend_code}
                      onRegenerate={friendsState.regenerateCode}
                    />
                  ) : null}
                  <AddFriendForm
                    onPreview={friendsState.preview}
                    onSend={(query) =>
                      'code' in query
                        ? friendsState.addByCode(query.code)
                        : friendsState.addByUsername(query.username)
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </FloatingPanel>

      {reportTarget ? (
        <ReportUserDialog
          onCancel={() => setReportTarget(null)}
          onSubmit={(reason) => friendsState.report(reportTarget.id, reason)}
        />
      ) : null}
    </>
  )
}
