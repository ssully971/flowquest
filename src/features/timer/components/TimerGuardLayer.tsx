import { useTimerSettings } from '../timer-settings-context'
import type { UseFocusTimerResult } from '../useFocusTimer'
import { GuardAnnouncement } from './GuardAnnouncement'
import { PresenceCheckDialog } from './PresenceCheckDialog'

/** Garde anti-oubli de 4 h, côté écran : annonce discrète + fenêtre « Tu es toujours là ? ».
 * Monté par l'écran Focus et l'écran Ambiant, qui lisent le même minuteur personnel. */
export function TimerGuardLayer({ timer }: { timer: UseFocusTimerResult }) {
  const { settings } = useTimerSettings()
  return (
    <>
      <GuardAnnouncement
        triggerKey={timer.guardAnnounceKey}
        enabled={settings.showGuardAnnouncement}
      />
      {timer.presenceCheck ? (
        <PresenceCheckDialog
          kind={timer.presenceCheck}
          soundBlocked={timer.presenceSoundBlocked}
          onConfirm={timer.confirmPresence}
          onEnd={timer.endSession}
        />
      ) : null}
    </>
  )
}
