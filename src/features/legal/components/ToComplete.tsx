/**
 * Marqueur visible pour un champ que seul l'éditeur de l'application peut renseigner
 * (raison sociale, adresse postale, coordonnées exactes d'un sous-traitant...) — jamais
 * inventé (lot I1, §3). Repris dans le compte rendu du lot sous forme de liste.
 */
export function ToComplete({ hint }: { hint: string }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[0.9em] font-semibold"
      style={{ background: 'rgba(242, 163, 58, 0.2)', color: 'var(--text)' }}
    >
      [À COMPLÉTER : {hint}]
    </span>
  )
}
