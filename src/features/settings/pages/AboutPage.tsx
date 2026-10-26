import { BACKGROUNDS } from '@/shared/design-system'
import { APP_VERSION } from '@/shared/app-version'
import { strings } from '@/shared/i18n'

/**
 * Sons d'ambiance crédités (lot I1, §4) : à la différence des fonds d'écran (voir
 * `credit` dans le registre BACKGROUNDS, lu plus bas — source unique, jamais dupliquée
 * ici), les 4 fichiers audio ne portent aucune métadonnée d'origine exploitable (voir
 * docs/CREDITS.md) — marqués « à compléter » plutôt qu'inventés.
 */
const SOUND_CREDITS = [
  { label: 'Pluie' },
  { label: 'Vagues' },
  { label: 'Forêt' },
  { label: 'Feu de camp' },
]

interface AboutPageProps {
  onOpenChangelog: () => void
}

export function AboutPage({ onOpenChangelog }: AboutPageProps) {
  const s = strings.settings.about
  // Fonds crédités (lot I1, §1) : dérivés directement du registre des fonds d'écran
  // (`credit` par entrée) plutôt que dupliqués ici en dur — une seule source, jamais de
  // désynchronisation possible avec la bibliothèque de Thèmes.
  const creditedBackgrounds = BACKGROUNDS.filter((bg): bg is typeof bg & { credit: string } =>
    Boolean(bg.credit),
  )

  return (
    <div className="flex flex-col gap-6">
      <h2
        className="text-[40px] font-extrabold text-[var(--panel-text)]"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {s.title}
      </h2>

      <div className="flex max-w-md items-center justify-between rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-4 text-sm">
        <span className="text-[var(--panel-text)]">{s.version}</span>
        <span className="text-[var(--panel-muted)]">{APP_VERSION}</span>
      </div>

      <div className="flex max-w-md flex-col gap-2">
        <p className="text-sm font-medium text-[var(--panel-muted)]">{s.linksTitle}</p>
        <a
          href="/conditions"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-3 text-sm text-[var(--panel-text)] underline-offset-2 hover:underline"
        >
          {s.terms}
        </a>
        <a
          href="/confidentialite"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-3 text-sm text-[var(--panel-text)] underline-offset-2 hover:underline"
        >
          {s.privacy}
        </a>
        <a
          href="/mentions-legales"
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-3 text-sm text-[var(--panel-text)] underline-offset-2 hover:underline"
        >
          {s.legalNotice}
        </a>
        <button
          type="button"
          onClick={onOpenChangelog}
          className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel-surface-2)] px-5 py-3 text-left text-sm text-[var(--panel-text)] underline-offset-2 hover:underline"
        >
          {s.changelogLink}
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-[var(--panel-muted)]">{s.creditsTitle}</p>
        <p className="max-w-md text-xs text-[var(--panel-muted)]">{s.creditsIntro}</p>

        <div className="flex max-w-md flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--panel-muted)]">{s.creditsPhotosTitle}</p>
          <ul className="flex flex-col gap-1.5">
            {creditedBackgrounds.map((bg) => (
              <li
                key={bg.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm"
              >
                <span className="text-[var(--panel-text)]">{bg.label}</span>
                <span className="text-right text-xs text-[var(--panel-muted)]">{bg.credit}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex max-w-md flex-col gap-2">
          <p className="text-xs font-semibold text-[var(--panel-muted)]">{s.creditsSoundsTitle}</p>
          <ul className="flex flex-col gap-1.5">
            {SOUND_CREDITS.map((sound) => (
              <li
                key={sound.label}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--panel-line)] px-4 py-2.5 text-sm"
              >
                <span className="text-[var(--panel-text)]">{sound.label}</span>
                <span className="text-right text-xs text-[var(--panel-muted)]">{s.toComplete}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
