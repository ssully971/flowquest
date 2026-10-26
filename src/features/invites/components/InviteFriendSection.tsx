import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { strings } from '@/shared/i18n'

import { formatFocusDuration, formatInviteDate, formatResetDate } from '../invite-code'
import { useInviteSection } from '../useInviteSection'
import { InviteCodeDisplay } from './InviteCodeDisplay'

function ProgressBar({
  label,
  valueText,
  value,
  max,
  hint,
}: {
  label: string
  valueText: string
  value: number
  max: number
  hint: string
}) {
  const percent = Math.min(100, Math.round((value / max) * 100))
  const done = value >= max
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium text-[var(--panel-text)]">{label}</span>
        <span className="text-[var(--panel-muted)]">{valueText}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        className="h-2 overflow-hidden rounded-full bg-[var(--panel-line)]"
      >
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {!done ? <p className="text-xs text-[var(--panel-muted)]">{hint}</p> : null}
    </div>
  )
}

/**
 * « Inviter un ami » (bêta fermée) : progression vers les conditions, génération d'un code,
 * liste de mes codes. Les seuils et limites viennent du serveur (get_invite_eligibility) ;
 * l'interface les affiche, elle ne les applique pas.
 */
export function InviteFriendSection() {
  const betaClosed = useFeatureFlag('beta_fermee')
  const {
    loading,
    loadFailed,
    eligibility,
    codes,
    generating,
    issued,
    errorKind,
    generate,
    retry,
  } = useInviteSection()
  const s = strings.invites.profile

  if (!betaClosed) return null

  const statusLabel = {
    active: s.statusActive,
    used: s.statusUsed,
    expired: s.statusExpired,
  } as const

  const focusMet = eligibility
    ? eligibility.focus_seconds >= eligibility.focus_required_seconds
    : false
  const ageMet = eligibility
    ? eligibility.account_age_days >= eligibility.account_age_required_days
    : false
  const limitReached = eligibility
    ? eligibility.codes_this_month >= eligibility.codes_monthly_limit
    : false
  const canGenerate = focusMet && ageMet && !limitReached

  return (
    <section className="flex max-w-sm flex-col gap-4" aria-labelledby="invite-friend-title">
      <h3 id="invite-friend-title" className="text-lg font-semibold text-[var(--panel-text)]">
        {s.title}
      </h3>
      <p className="text-sm text-[var(--panel-muted)]">{s.intro}</p>

      {loading ? (
        <p className="text-sm text-[var(--panel-muted)]">{s.loading}</p>
      ) : loadFailed || !eligibility ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm text-[#E5484D]">
            {s.loadError}
          </p>
          <button
            type="button"
            onClick={retry}
            className="h-9 w-fit rounded-lg border border-[var(--panel-line)] px-3 text-xs text-[var(--panel-text)]"
          >
            {s.retry}
          </button>
        </div>
      ) : (
        <>
          {!canGenerate && !limitReached ? (
            <div className="flex flex-col gap-4">
              <ProgressBar
                label={s.focusLabel}
                valueText={`${formatFocusDuration(eligibility.focus_seconds)} / ${formatFocusDuration(eligibility.focus_required_seconds)}`}
                value={eligibility.focus_seconds}
                max={eligibility.focus_required_seconds}
                hint={s.motivationFocus}
              />
              <ProgressBar
                label={s.ageLabel}
                valueText={`${Math.min(eligibility.account_age_days, eligibility.account_age_required_days)} / ${eligibility.account_age_required_days} ${s.daysUnit}`}
                value={eligibility.account_age_days}
                max={eligibility.account_age_required_days}
                hint={s.motivationAge}
              />
            </div>
          ) : null}

          {limitReached ? (
            <p className="text-sm text-[var(--panel-text)]">
              {s.monthlyLimitReached} {s.nextResetPrefix}{' '}
              {formatResetDate(eligibility.next_reset_at)}.
            </p>
          ) : canGenerate ? (
            <p className="text-sm text-[var(--panel-text)]">{s.conditionsMet}</p>
          ) : null}

          <p className="text-xs text-[var(--panel-muted)]">
            {eligibility.codes_this_month} / {eligibility.codes_monthly_limit}{' '}
            {s.monthlyCounterSuffix}
          </p>

          <button
            type="button"
            onClick={() => void generate()}
            disabled={!canGenerate || generating}
            className="h-11 rounded-xl bg-[var(--accent)] text-sm font-semibold text-[var(--on-accent)] transition-opacity duration-200 disabled:opacity-50"
          >
            {generating ? s.generating : s.generate}
          </button>

          {errorKind ? (
            <p role="alert" className="text-sm text-[#E5484D]">
              {s.errors[errorKind]}
            </p>
          ) : null}

          {issued ? (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-[var(--panel-text)]">{s.newCodeTitle}</h4>
              <InviteCodeDisplay code={issued.code} expiresAt={issued.expires_at} shareable />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold text-[var(--panel-text)]">{s.yourCodes}</h4>
            {codes.length === 0 ? (
              <p className="text-sm text-[var(--panel-muted)]">{s.noCodes}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {codes.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-col gap-0.5 rounded-xl border border-[var(--panel-line)] px-3 py-2"
                  >
                    <span className="font-mono text-sm tracking-widest text-[var(--panel-text)]">
                      {row.code}
                    </span>
                    <span className="text-xs text-[var(--panel-muted)]">
                      {statusLabel[row.status]}
                      {row.status === 'used'
                        ? ` ${s.usedByPrefix} ${row.used_by_username ?? s.usedByFriend}`
                        : row.expires_at
                          ? ` — ${s.expiresPrefix} ${formatInviteDate(row.expires_at)}`
                          : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
