import { useRef, useState } from 'react'

import { SignInPrompt } from '@/features/auth/components/SignInPrompt'
import { useAuth } from '@/features/auth/useAuth'
import { FloatingPanel } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { useDuoStreaks } from '../useDuoStreaks'
import { useFriends } from '../useFriends'
import { useLeaderboard } from '../useLeaderboard'
import type { Friend } from '../types'
import { AddFriendForm } from './AddFriendForm'
import { FriendCard } from './FriendCard'
import { FriendRequestsList } from './FriendRequestsList'
import { LeaderboardTab } from './LeaderboardTab'
import { MyFriendCode } from './MyFriendCode'
import { ReportUserDialog } from './ReportUserDialog'

interface FriendsPanelProps {
  open: boolean
  onClose: () => void
}

type Tab = 'friends' | 'requests' | 'leaderboard' | 'add'

export function FriendsPanel({ open, onClose }: FriendsPanelProps) {
  const s = strings.friends
  const { status, isSupabaseConfigured, profile } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('friends')
  const [reportTarget, setReportTarget] = useState<Friend | null>(null)
  const friendsState = useFriends()
  const leaderboardState = useLeaderboard()
  const duoStreaksState = useDuoStreaks()

  if (!open) return null

  const streakByFriendId = new Map(duoStreaksState.streaks.map((streak) => [streak.friendId, streak]))

  const requestCount = friendsState.incomingRequests.length

  const TABS: { value: Tab; label: string; badge?: number }[] = [
    { value: 'friends', label: s.tabs.friends },
    { value: 'requests', label: s.tabs.requests, badge: requestCount },
    { value: 'leaderboard', label: s.leaderboard.tab },
    { value: 'add', label: s.tabs.add },
  ]

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
        {!isSupabaseConfigured ? (
          <p className="max-w-sm text-sm text-[var(--muted)]">{s.signInRequired}</p>
        ) : status !== 'authenticated' ? (
          <SignInPrompt message={s.signInRequired} ctaLabel={s.signInCta} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
            <div
              role="tablist"
              aria-label={s.panelTitle}
              className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1"
            >
              {TABS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  onClick={() => setTab(item.value)}
                  className={`relative rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                    tab === item.value ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
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
              ) : friendsState.isLoading ? (
                <p className="text-sm text-[var(--muted)]">{s.loading}</p>
              ) : friendsState.loadError ? (
                <div className="flex flex-col items-start gap-2">
                  <p role="alert" className="text-sm text-[var(--muted)]">
                    {s.loadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => void friendsState.refresh()}
                    className="h-9 rounded-xl border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)]"
                  >
                    {s.retry}
                  </button>
                </div>
              ) : tab === 'friends' ? (
                <div className="flex flex-col gap-2">
                  {friendsState.friends.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">{s.empty.friends}</p>
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
                    <MyFriendCode code={profile.friend_code} onRegenerate={friendsState.regenerateCode} />
                  ) : null}
                  <AddFriendForm
                    onPreview={friendsState.preview}
                    onSend={(query) =>
                      'code' in query ? friendsState.addByCode(query.code) : friendsState.addByUsername(query.username)
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
