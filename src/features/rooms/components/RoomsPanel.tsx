import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { useFriends } from '@/features/friends/useFriends'
import { FloatingPanel } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { useRooms } from '../useRooms'
import { CreateRoomForm } from './CreateRoomForm'
import { RoomCard } from './RoomCard'

interface RoomsPanelProps {
  open: boolean
  onClose: () => void
  onOpenRoom: (roomId: string) => void
}

type Tab = 'mine' | 'create'

export function RoomsPanel({ open, onClose, onOpenRoom }: RoomsPanelProps) {
  const s = strings.rooms
  const { status, isSupabaseConfigured } = useAuth()
  const panelRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<Tab>('mine')
  const roomsState = useRooms()
  const friendsState = useFriends()
  const { refresh: refreshRooms } = roomsState

  // useRooms() charge une seule fois au montage (celui, unique, d'AppShell — le panneau
  // lui-même reste monté même fermé, `open` ne fait que masquer le rendu). Sans ce
  // rafraîchissement à l'ouverture, une invitation reçue pendant que le panneau était
  // fermé resterait invisible indéfiniment (trouvé via le test Playwright à deux
  // contextes des salons, LOT F3).
  useEffect(() => {
    if (open) void refreshRooms()
  }, [open, refreshRooms])

  if (!open) return null

  const handleAccept = (roomId: string) => {
    void roomsState.respond(roomId, true).then((ok) => {
      if (ok) onOpenRoom(roomId)
    })
  }
  const handleCreated = (roomId: string) => {
    onOpenRoom(roomId)
  }

  return (
    <FloatingPanel
      panelRef={panelRef}
      mode="window"
      title={s.panelTitle}
      closeLabel={s.closeLabel}
      onClose={onClose}
      panelSizeClassName="w-[24rem]"
      windowSizeClassName="w-full max-w-[36rem] max-h-[85vh]"
    >
      {!isSupabaseConfigured || status !== 'authenticated' ? (
        <p className="max-w-sm text-sm text-[var(--muted)]">{s.signInRequired}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div
            role="tablist"
            aria-label={s.panelTitle}
            className="inline-flex w-fit items-center gap-1 rounded-full border border-[var(--line)] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'mine'}
              onClick={() => setTab('mine')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                tab === 'mine' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
              }`}
            >
              {s.tabs.mine}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'create'}
              onClick={() => setTab('create')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors duration-200 ${
                tab === 'create' ? 'bg-[var(--surface-2)] text-[var(--text)]' : 'text-[var(--muted)]'
              }`}
            >
              {s.tabs.create}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'create' ? (
              <CreateRoomForm friends={friendsState.friends} onCreate={roomsState.create} onCreated={handleCreated} />
            ) : roomsState.isLoading ? (
              <p className="text-sm text-[var(--muted)]">{s.loading}</p>
            ) : roomsState.loadError ? (
              <div className="flex flex-col items-start gap-2">
                <p role="alert" className="text-sm text-[var(--muted)]">
                  {s.loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void roomsState.refresh()}
                  className="h-9 rounded-xl border border-[var(--line)] px-3.5 text-xs font-medium text-[var(--text)]"
                >
                  {s.retry}
                </button>
              </div>
            ) : roomsState.rooms.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">{s.empty}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {roomsState.rooms.map((room) => (
                  <RoomCard
                    key={room.roomId}
                    room={room}
                    onAccept={handleAccept}
                    onDecline={(roomId) => void roomsState.respond(roomId, false)}
                    onJoin={onOpenRoom}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </FloatingPanel>
  )
}
