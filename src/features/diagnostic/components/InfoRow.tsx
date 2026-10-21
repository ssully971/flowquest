interface InfoRowProps {
  label: string
  value: string
}

/**
 * Ligne d'information simple (pas un contrôle réussi/échoué comme CheckRow) : utilisée
 * pour afficher clairement l'identité du compte connecté (e-mail, id, pseudo, rôle —
 * LOT E8), pour que la personne connectée puisse vérifier d'un coup d'œil si elle est
 * bien administratrice, sans avoir à déduire l'information d'une ligne de contrôle.
 */
export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] px-3.5 py-2.5">
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm text-[var(--text)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </li>
  )
}
