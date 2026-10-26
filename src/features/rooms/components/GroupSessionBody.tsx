import { PictureInPicture2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { TimerControls } from '@/features/timer/components/TimerControls'
import { IconButton } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import type { ActiveGroupRoomValue } from '../active-room-context'
import { GroupParticipants } from './GroupParticipants'

interface GroupSessionBodyProps {
  group: ActiveGroupRoomValue
  currentUserId: string | null
  /** Horloge (TimerFace réglée comme l'horloge solo : mêmes thèmes, taille, couleur). */
  face: ReactNode
  /** Repères du cycle Pomodoro (pastilles + objectif), déjà calculés par l'écran Focus. */
  cycle: ReactNode
  pip: { toggle: () => void; isSupported: boolean; show: boolean }
}

/**
 * Corps de l'écran Focus pendant une session de groupe (LOT M3) : même emplacement et même
 * style que le minuteur personnel, mais piloté par le salon côté serveur. L'hôte voit les
 * contrôles (démarrer / pause / reprendre / terminer) ; les autres voient l'horloge en
 * lecture seule et un bouton « Quitter ». Le minuteur personnel est masqué (en pause).
 */
export function GroupSessionBody({ group, currentUserId, face, cycle, pip }: GroupSessionBodyProps) {
  const s = strings.rooms.group
  const { room, view, isHost, actions } = group
  if (!room || !view) return null

  const status = view.status === 'running' ? 'running' : view.status === 'paused' ? 'paused' : 'idle'

  const handleLeave = () => {
    if (window.confirm(s.confirmLeave)) void actions.leave()
  }
  const handleEnd = () => {
    if (window.confirm(s.confirmEnd)) void actions.end()
  }
  const handlePrimary = () => {
    if (status === 'running') void actions.pause()
    else if (status === 'paused') void actions.resume()
    else void actions.start()
  }

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <span className="rounded-full border border-[var(--line)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          {s.badge} · {strings.rooms.modes[room.mode]}
        </span>
        {room.mode === 'pomodoro' && view.status !== 'lobby' ? (
          <span className="text-sm font-semibold text-[var(--text)]">
            {strings.rooms.phase[view.phase]}
          </span>
        ) : null}
        {view.status === 'lobby' ? (
          <span className="text-sm font-semibold text-[var(--text)]">
            {isHost ? s.waitingHost : s.waiting}
          </span>
        ) : null}
      </div>

      {room.mode === 'pomodoro' ? cycle : null}

      {face}

      {isHost ? (
        <TimerControls
          status={status}
          onReset={() => undefined}
          showReset={false}
          onPrimary={handlePrimary}
          onSkip={() => undefined}
          showSkip={false}
          onEndSession={handleEnd}
          showEndSession={view.status !== 'lobby'}
          onPictureInPicture={pip.toggle}
          pipAvailable={pip.isSupported}
          showPip={pip.show}
        />
      ) : (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-[var(--muted)]">{s.readOnlyHint}</p>
          {pip.show ? (
            <IconButton
              icon={PictureInPicture2}
              label={
                pip.isSupported
                  ? strings.focus.controls.pictureInPicture
                  : strings.focus.controls.pictureInPictureUnavailable
              }
              onClick={pip.toggle}
              disabled={!pip.isSupported}
            />
          ) : null}
        </div>
      )}

      <GroupParticipants
        participants={room.participants}
        view={view}
        currentUserId={currentUserId}
        isHost={isHost}
        onTransferHost={(userId) => void actions.transfer(userId)}
      />

      <p className="text-xs text-[var(--muted)]">{s.soloPaused}</p>

      <button
        type="button"
        onClick={handleLeave}
        className="h-10 rounded-xl border border-[var(--line)] px-5 text-sm font-medium text-[var(--text)] transition-opacity duration-200"
      >
        {s.leave}
      </button>
    </>
  )
}
