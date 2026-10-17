export function AdminPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--bg)] p-6 text-center text-[var(--text)]">
      <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
        Admin
      </h1>
      <p className="max-w-sm text-sm text-[var(--muted)]">
        Panneau administrateur — à venir (thèmes, citations, sons, défis, succès, nouveautés,
        support). Voir §12 du cahier des charges.
      </p>
    </div>
  )
}
