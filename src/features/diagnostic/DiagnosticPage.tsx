import { useEffect, useState } from 'react'

import { useAuth } from '@/features/auth/useAuth'
import { isSupabaseConfigured } from '@/shared/supabase/client'
import { strings } from '@/shared/i18n'

import {
  checkEnvVars,
  checkExpectedFunctions,
  checkSupabaseUrlFormat,
  checkTableReads,
  fetchSchemaIntrospection,
} from './checks'
import type { FunctionCheck, SchemaIntrospection, TableReadCheck } from './checks'
import { clearAllLocalStorage } from './clear-local-storage'
import { CheckRow } from './components/CheckRow'
import { InfoRow } from './components/InfoRow'

/**
 * Page publique (aucune authentification requise, aucune donnée sensible affichée) :
 * utile à n'importe qui pour vérifier la configuration Supabase et signaler un problème
 * précis (code d'erreur exact) plutôt qu'un vague « ça ne marche pas ».
 */
export function DiagnosticPage() {
  const s = strings.diagnostic
  const { status, session, profile, profileState } = useAuth()
  const [introspection, setIntrospection] = useState<SchemaIntrospection | null>(null)
  const [tableChecks, setTableChecks] = useState<TableReadCheck[] | null>(null)
  const [isClearingStorage, setIsClearingStorage] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void fetchSchemaIntrospection().then(setIntrospection)
    void checkTableReads().then(setTableChecks)
  }, [])

  const envChecks = checkEnvVars()
  const urlFormat = checkSupabaseUrlFormat()
  const functionChecks: FunctionCheck[] | null = introspection
    ? checkExpectedFunctions(introspection.paths)
    : null

  const handleClearStorage = () => {
    if (!window.confirm(s.clearStorageConfirm)) return
    setIsClearingStorage(true)
    void clearAllLocalStorage().then(() => {
      window.location.reload()
    })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 bg-[var(--bg)] p-6 text-[var(--text)]">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {s.title}
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{s.intro}</p>
      </div>

      <a href="/" className="w-fit text-sm text-[var(--accent)] underline-offset-2 hover:underline">
        {s.backHome}
      </a>

      {!isSupabaseConfigured ? (
        <p role="status" className="text-sm text-[var(--muted)]">
          {s.notConfigured}
        </p>
      ) : null}

      <section className="flex flex-col gap-2 rounded-xl border border-[#E5484D] p-4">
        <h2 className="text-sm font-semibold text-[#E5484D]">{s.clearStorageTitle}</h2>
        <p className="text-xs text-[var(--muted)]">{s.clearStorageHint}</p>
        <button
          type="button"
          onClick={handleClearStorage}
          disabled={isClearingStorage}
          className="mt-1 inline-flex h-11 w-fit items-center rounded-full border border-[#E5484D] px-5 text-sm font-medium text-[#E5484D] transition-colors duration-200 hover:bg-[#E5484D] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isClearingStorage ? s.clearStorageInProgress : s.clearStorageButton}
        </button>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-[var(--muted)]">{s.envTitle}</h2>
        <ul className="flex flex-col gap-1.5">
          {envChecks.map((check) => (
            <CheckRow
              key={check.name}
              label={check.name}
              status={check.present ? 'ok' : 'error'}
              statusLabel={check.present ? s.envPresent : s.envMissing}
            />
          ))}
        </ul>
      </section>

      {isSupabaseConfigured ? (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.urlTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              <CheckRow
                label="VITE_SUPABASE_URL"
                status={urlFormat?.ok ? 'ok' : 'error'}
                statusLabel={urlFormat?.ok ? s.urlOk : s.urlIssue}
                detail={urlFormat && !urlFormat.ok ? urlFormat.issues.join(' · ') : undefined}
              />
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.reachabilityTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              <CheckRow
                label="GET /rest/v1/"
                status={!introspection ? 'pending' : introspection.reachable ? 'ok' : 'error'}
                statusLabel={
                  !introspection ? s.checking : introspection.reachable ? s.reachable : s.unreachable
                }
                detail={
                  introspection && !introspection.reachable
                    ? (introspection.error ?? `HTTP ${introspection.status ?? '?'}`)
                    : undefined
                }
              />
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.functionsTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              {(functionChecks ?? []).map((check) => (
                <CheckRow
                  key={check.name}
                  label={check.name}
                  status={check.found ? 'ok' : 'error'}
                  statusLabel={check.found ? s.functionFound : s.functionMissing}
                />
              ))}
              {!functionChecks ? (
                <CheckRow label="…" status="pending" statusLabel={s.checking} />
              ) : null}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.tablesTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              {(tableChecks ?? []).map((check) => (
                <CheckRow
                  key={check.table}
                  label={check.table}
                  status={check.ok ? 'ok' : 'error'}
                  statusLabel={check.ok ? s.tableOk : s.tableError}
                  detail={!check.ok ? `${check.errorCode ?? '?'} — ${check.errorMessage ?? ''}` : undefined}
                />
              ))}
              {!tableChecks ? <CheckRow label="…" status="pending" statusLabel={s.checking} /> : null}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.accountTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              {status === 'authenticated' && session ? (
                <>
                  <InfoRow label={s.accountEmail} value={session.user.email ?? '—'} />
                  <InfoRow label={s.accountId} value={session.user.id} />
                  <InfoRow label={s.accountUsername} value={profile?.username ?? '—'} />
                  <InfoRow label={s.accountRole} value={profile?.role ?? '—'} />
                </>
              ) : (
                <li className="rounded-xl border border-[var(--line)] px-3.5 py-2.5 text-sm text-[var(--muted)]">
                  {s.accountNotSignedIn}
                </li>
              )}
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.sessionTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              <CheckRow
                label={session?.user.email ?? '—'}
                status={status === 'loading' ? 'pending' : status === 'authenticated' ? 'ok' : 'error'}
                statusLabel={
                  status === 'loading' ? s.sessionLoading : status === 'authenticated' ? s.sessionActive : s.sessionGuest
                }
              />
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-[var(--muted)]">{s.profileTitle}</h2>
            <ul className="flex flex-col gap-1.5">
              <CheckRow
                label={profile ? `${profile.username} (${profile.role})` : 'profiles'}
                status={
                  status !== 'authenticated' ? 'pending' : profileState === 'loaded' ? 'ok' : 'error'
                }
                statusLabel={
                  status !== 'authenticated'
                    ? s.profileNotApplicable
                    : profileState === 'loaded'
                      ? s.profileLoaded
                      : s.profileError
                }
              />
            </ul>
          </section>
        </>
      ) : null}
    </div>
  )
}
