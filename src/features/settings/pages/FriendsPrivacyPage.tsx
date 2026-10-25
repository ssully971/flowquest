import { SignInPrompt } from '@/features/auth/components/SignInPrompt'
import { useAuth } from '@/features/auth/useAuth'
import { SettingsToggleRow } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

/**
 * Réglages de vie privée du Mode Amis (LOT F1, §3) : tout est stocké dans profiles
 * (colonnes posées par la migration 0020_profiles_social_fields.sql) et appliqué côté
 * base (RLS, fonctions are_friends()/list_friends()...), jamais seulement côté interface
 * — ces interrupteurs ne font qu'écrire la même ligne que le reste du profil.
 */
export function FriendsPrivacyPage() {
  const s = strings.settings.friendsPrivacy
  const { status, profile, updateProfile } = useAuth()

  // Avant (LOT H1, §3) : cet écran n'affichait rien du tout en mode invité.
  if (status !== 'authenticated') {
    return <SignInPrompt message={s.signInRequired} ctaLabel={s.signInCta} />
  }

  if (!profile) return null

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <SettingsToggleRow
        label={s.invisibleMode}
        hint={s.invisibleModeHint}
        checked={profile.invisible_mode}
        onToggle={() => void updateProfile({ invisible_mode: !profile.invisible_mode })}
      />

      <SettingsToggleRow
        label={s.showLiveStatus}
        hint={s.showLiveStatusHint}
        checked={profile.show_live_status}
        onToggle={() => void updateProfile({ show_live_status: !profile.show_live_status })}
      />

      <SettingsToggleRow
        label={s.showTotalTimeScore}
        hint={s.showTotalTimeScoreHint}
        checked={profile.show_total_time_score}
        onToggle={() => void updateProfile({ show_total_time_score: !profile.show_total_time_score })}
      />

      <SettingsToggleRow
        label={s.participateLeaderboard}
        hint={s.participateLeaderboardHint}
        checked={profile.participate_leaderboard}
        onToggle={() => void updateProfile({ participate_leaderboard: !profile.participate_leaderboard })}
      />
    </div>
  )
}
