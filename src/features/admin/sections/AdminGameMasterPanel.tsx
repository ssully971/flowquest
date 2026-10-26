import { useEffect, useState } from 'react'

import { useFeatureFlag } from '@/features/feature-flags/useFeatureFlag'
import { strings } from '@/shared/i18n'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import type { AdminUserPillarRow, AdminUserRow } from '@/shared/supabase/database.types'
import { useToast } from '@/shared/toast'

import {
  listCampaigns,
  startCustomCampaign,
  startDoubleXpWeekend,
  stopCampaign,
} from '../admin-campaigns'
import type { GameCampaignRow } from '../admin-campaigns'
import { listAdminUsers } from '../admin-users'
import { XP_GRANT_MAX_AMOUNT, grantXp, listUserPillarsForGrant } from '../admin-xp-grants'

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Maître du jeu (LOT I3, §6) : campagnes XP (raccourci Double XP + campagne
 * personnalisée, une seule active à la fois — admin_start_campaign désactive l'ancienne
 * côté serveur) et cadeaux d'XP ciblés. Grisé entièrement si le drapeau « pillars » est
 * désactivé : l'XP n'a aucun sens sans piliers.
 */
export function AdminGameMasterPanel() {
  const s = strings.gameMaster.admin
  const pillarsEnabled = useFeatureFlag('pillars')
  const { showToast } = useToast()

  const [campaigns, setCampaigns] = useState<GameCampaignRow[]>([])
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [starting, setStarting] = useState(false)
  const [stoppingId, setStoppingId] = useState<string | null>(null)

  const [customName, setCustomName] = useState('')
  const [customMultiplier, setCustomMultiplier] = useState('2')
  const [customStartsAt, setCustomStartsAt] = useState(() => toLocalInputValue(new Date()))
  const [customEndsAt, setCustomEndsAt] = useState(() =>
    toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  )

  const [userQuery, setUserQuery] = useState('')
  const [userResults, setUserResults] = useState<AdminUserRow[]>([])
  const [targetUser, setTargetUser] = useState<AdminUserRow | null>(null)
  const [targetPillars, setTargetPillars] = useState<AdminUserPillarRow[]>([])
  const [grantPillarId, setGrantPillarId] = useState('')
  const [grantAmount, setGrantAmount] = useState('100')
  const [grantReason, setGrantReason] = useState('')
  const [granting, setGranting] = useState(false)

  // Pas de setLoadingCampaigns(true) ici : la valeur initiale (true) couvre déjà le
  // premier chargement ; les rafraîchissements suivants (après démarrage/arrêt d'une
  // campagne) partent d'un bouton, jamais d'un effet.
  const fetchCampaigns = () => {
    void listCampaigns().then((data) => {
      setCampaigns(data)
      setLoadingCampaigns(false)
    })
  }

  const refreshCampaigns = () => {
    setLoadingCampaigns(true)
    fetchCampaigns()
  }

  useEffect(fetchCampaigns, [])

  useEffect(() => {
    if (!userQuery.trim()) return
    const timeout = window.setTimeout(() => {
      void listAdminUsers(5, 0, userQuery, 'username_asc').then(setUserResults)
    }, 200)
    return () => window.clearTimeout(timeout)
  }, [userQuery])

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-[var(--muted)]">{strings.admin.notConfigured}</p>
  }

  const disabled = !pillarsEnabled
  const activeCampaign = campaigns.find((campaign) => campaign.active) ?? null

  const handleStartDoubleXp = () => {
    setStarting(true)
    void startDoubleXpWeekend().then((result) => {
      setStarting(false)
      if (!result) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      refreshCampaigns()
    })
  }

  const handleStartCustom = () => {
    const multiplier = Number.parseFloat(customMultiplier)
    if (!customName.trim() || Number.isNaN(multiplier) || multiplier <= 0) return
    setStarting(true)
    void startCustomCampaign(
      customName.trim(),
      multiplier,
      new Date(customStartsAt),
      new Date(customEndsAt),
    ).then((result) => {
      setStarting(false)
      if (!result) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      setCustomName('')
      refreshCampaigns()
    })
  }

  const handleStop = (campaignId: string) => {
    setStoppingId(campaignId)
    void stopCampaign(campaignId).then((ok) => {
      setStoppingId(null)
      if (!ok) {
        showToast({ type: 'error', message: s.actionError })
        return
      }
      refreshCampaigns()
    })
  }

  const handleSelectUser = (user: AdminUserRow) => {
    setTargetUser(user)
    setUserQuery('')
    setUserResults([])
    setGrantPillarId('')
    void listUserPillarsForGrant(user.id).then(setTargetPillars)
  }

  const handleGrant = () => {
    const amount = Number.parseInt(grantAmount, 10)
    if (!targetUser || !grantPillarId || !grantReason.trim() || Number.isNaN(amount) || amount <= 0)
      return
    setGranting(true)
    void grantXp(targetUser.id, grantPillarId, amount, grantReason.trim())
      .then(() => {
        setGranting(false)
        setGrantReason('')
        showToast({ type: 'success', message: s.grantSuccess })
      })
      .catch(() => {
        setGranting(false)
        showToast({ type: 'error', message: s.grantError })
      })
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-lg text-sm text-[var(--muted)]">{s.intro}</p>
      {disabled ? <p className="text-sm text-[#F59E0B]">{s.disabledByFlag}</p> : null}

      <div className={`flex flex-col gap-3 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <h3 className="text-sm font-semibold text-[var(--text)]">{s.currentCampaignTitle}</h3>
        {loadingCampaigns ? null : activeCampaign ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] p-3">
            <div>
              <p className="text-sm text-[var(--text)]">
                {activeCampaign.name} · ×{activeCampaign.xp_multiplier}
              </p>
              <p className="text-xs text-[var(--muted)]">
                {formatWhen(activeCampaign.starts_at)} → {formatWhen(activeCampaign.ends_at)}
              </p>
            </div>
            <button
              type="button"
              disabled={stoppingId === activeCampaign.id}
              onClick={() => handleStop(activeCampaign.id)}
              className="h-9 rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)] disabled:opacity-50"
            >
              {s.stopCampaign}
            </button>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">{s.noActiveCampaign}</p>
        )}

        <button
          type="button"
          disabled={starting}
          onClick={handleStartDoubleXp}
          className="h-10 w-fit rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-[var(--on-accent)] disabled:opacity-50"
        >
          {starting ? s.starting : s.startDoubleXpWeekend}
        </button>

        <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-3">
          <p className="text-sm font-medium text-[var(--text)]">{s.customCampaignTitle}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.nameLabel}
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder={s.namePlaceholder}
                className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.multiplierLabel}
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.1"
                value={customMultiplier}
                onChange={(event) => setCustomMultiplier(event.target.value)}
                className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.startsAtLabel}
              <input
                type="datetime-local"
                value={customStartsAt}
                onChange={(event) => setCustomStartsAt(event.target.value)}
                className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.endsAtLabel}
              <input
                type="datetime-local"
                value={customEndsAt}
                onChange={(event) => setCustomEndsAt(event.target.value)}
                className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={starting || !customName.trim()}
            onClick={handleStartCustom}
            className="h-9 w-fit rounded-lg border border-[var(--line)] px-3 text-xs text-[var(--text)] disabled:opacity-50"
          >
            {starting ? s.starting : s.startCampaign}
          </button>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-[var(--muted)]">{s.historyTitle}</p>
          {campaigns.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{s.noHistory}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]"
                >
                  <span>
                    {campaign.name} · ×{campaign.xp_multiplier} · {formatWhen(campaign.starts_at)} →{' '}
                    {formatWhen(campaign.ends_at)}
                  </span>
                  {campaign.active ? (
                    <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 font-medium text-[var(--on-accent)]">
                      {s.activeBadge}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={`flex flex-col gap-3 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
        <h3 className="text-sm font-semibold text-[var(--text)]">{s.grantXpTitle}</h3>
        <input
          value={targetUser ? targetUser.username : userQuery}
          onChange={(event) => {
            setTargetUser(null)
            setUserQuery(event.target.value)
            if (!event.target.value.trim()) setUserResults([])
          }}
          placeholder={strings.admin.users.searchPlaceholder}
          className="h-10 w-full max-w-sm rounded-xl border border-[var(--line)] bg-transparent px-3 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />
        {userResults.length > 0 ? (
          <div className="flex max-w-sm flex-col gap-1 rounded-xl border border-[var(--line)] p-1">
            {userResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectUser(user)}
                className="rounded-lg px-2 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--surface-2)]"
              >
                {user.username} <span className="text-xs text-[var(--muted)]">{user.email}</span>
              </button>
            ))}
          </div>
        ) : null}

        {targetUser ? (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--line)] p-3">
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.grantUserHint}
              {targetPillars.length === 0 ? (
                <span className="text-sm text-[var(--text)]">{s.noPillarsForUser}</span>
              ) : (
                <select
                  value={grantPillarId}
                  onChange={(event) => setGrantPillarId(event.target.value)}
                  className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
                >
                  <option value="">—</option>
                  {targetPillars.map((pillar) => (
                    <option key={pillar.id} value={pillar.id}>
                      {pillar.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.amountLabel}
              <input
                type="number"
                min="1"
                max={XP_GRANT_MAX_AMOUNT}
                value={grantAmount}
                onChange={(event) => setGrantAmount(event.target.value)}
                className="h-9 w-32 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
              {s.reasonLabel}
              <input
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                placeholder={s.reasonPlaceholder}
                className="h-9 rounded-lg border border-[var(--line)] bg-transparent px-2 text-sm text-[var(--text)] outline-none"
              />
            </label>
            <button
              type="button"
              disabled={granting || !grantPillarId || !grantReason.trim()}
              onClick={handleGrant}
              className="h-9 w-fit rounded-lg bg-[var(--accent)] px-3 text-xs font-medium text-[var(--on-accent)] disabled:opacity-50"
            >
              {granting ? s.granting : s.grantSubmit}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
