import { Bold, Heading2, Italic, List, ListChecks, Quote } from 'lucide-react'

import { strings } from '@/shared/i18n'

interface NoteToolbarProps {
  onBold: () => void
  onItalic: () => void
  onHeading: () => void
  onQuote: () => void
  onBulletList: () => void
  onChecklist: () => void
}

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      // Évite que le clic ne vole le focus (et donc la sélection de texte) à l'éditeur
      // avant que la commande ne s'applique.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className="fq-icon-btn"
    >
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  )
}

export function NoteToolbar({
  onBold,
  onItalic,
  onHeading,
  onQuote,
  onBulletList,
  onChecklist,
}: NoteToolbarProps) {
  const s = strings.notes

  return (
    <div className="fq-toolbar" role="toolbar" aria-label={s.toolbar}>
      <ToolbarButton icon={Bold} label={s.bold} onClick={onBold} />
      <ToolbarButton icon={Italic} label={s.italic} onClick={onItalic} />
      <ToolbarButton icon={Heading2} label={s.heading} onClick={onHeading} />
      <ToolbarButton icon={Quote} label={s.quote} onClick={onQuote} />
      <ToolbarButton icon={List} label={s.bulletList} onClick={onBulletList} />
      <ToolbarButton icon={ListChecks} label={s.checklist} onClick={onChecklist} />
    </div>
  )
}
