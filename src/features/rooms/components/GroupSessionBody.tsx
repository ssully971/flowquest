import { Loader2, PictureInPicture2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { TimerControls } from '@/features/timer/components/TimerControls'
import { IconButton } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { useState } from 'react'

import type { ActiveGroupRoomValue } from '../active-room-context'
import { GroupParticipants } from './GroupParticipants'
import { InviteToRoomDialog } from './InviteToRoomDialog'

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
export function GroupSessionBody({
  group,
  currentUserId,
  face,
  cycle,
  pip,
}: GroupSessionBodyProps) {
  const s = strings.rooms.group
  const { room, view, isHost, actions, pendingAction, actionError, dismissActionError } = group
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  if (!room || !view) return null

  // Action en cours : boutons désactivés + libellé (« Lancement… »), jamais un bouton muet.
  const busyLabel = pendingAction ? s.pending[pendingAction] : null

  const status =
    view.status === 'running' ? 'running' : view.status === 'paused' ? 'paused' : 'idle'

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
          busyLabel={busyLabel}
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

      {busyLabel ? (
        <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--text)]">
          <Loader2 size={14} strokeWidth={2} aria-hidden="true" className="animate-spin" />
          {busyLabel}
        </p>
      ) : null}

      {actionError ? (
        <div
          role="alert"
          className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)]"
        >
          <p>{actionError.message}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={actionError.retry}
              className="h-9 rounded-xl bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--on-accent)]"
            >
              {strings.rooms.retry}
            </button>
            <button
              type="button"
              onClick={dismissActionError}
              className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
            >
              {s.dismissError}
            </button>
          </div>
        </div>
      ) : null}

      <GroupParticipants
        participants={room.participants}
        view={view}
        currentUserId={currentUserId}
        isHost={isHost}
        onTransferHost={(userId) => void actions.transfer(userId)}
        disabled={pendingAction !== null}
        onInvite={() => setIsInviteOpen(true)}
      />

      {isInviteOpen ? (
        <InviteToRoomDialog
          room={room}
          busy={pendingAction === 'invite'}
          onInvite={actions.invite}
          onClose={() => setIsInviteOpen(false)}
        />
      ) : null}

      <p className="text-xs text-[var(--muted)]">{s.soloPaused}</p>

      <button
        type="button"
        onClick={handleLeave}
        disabled={pendingAction !== null}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] px-5 text-sm font-medium text-[var(--text)] transition-opacity duration-200 disabled:cursor-wait disabled:opacity-60"
      >
        {pendingAction === 'leave' ? (
          <Loader2 size={14} strokeWidth={2} aria-hidden="true" className="animate-spin" />
        ) : null}
        {pendingAction === 'leave' ? s.pending.leave : s.leave}
      </button>
    </>
  )
}
