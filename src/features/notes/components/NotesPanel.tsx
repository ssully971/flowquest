import type { ClipboardEvent, MouseEvent } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useExtrasSettings } from '@/features/settings/extras-settings-context'
import { FloatingPanel } from '@/shared/design-system'
import { strings } from '@/shared/i18n'

import { htmlToPlainText, sanitizeNoteHtml } from '../note-html'
import { useNote } from '../useNote'
import { NoteToolbar } from './NoteToolbar'

interface NotesPanelProps {
  open: boolean
  onClose: () => void
}

/**
 * Éditeur riche (§8 : gras, italique, titres, listes, cases) via un <div
 * contentEditable> non contrôlé : le contenu HTML n'est resynchronisé depuis `content`
 * que lors d'un changement externe (chargement initial, tirage distant), jamais à
 * chaque frappe — sinon le curseur sauterait en tête de note à chaque caractère.
 * document.execCommand() reste, malgré son statut « déprécié », la seule API
 * multi-navigateur pour piloter un contentEditable sans bibliothèque d'édition dédiée ;
 * en contrepartie, tout ce qu'il produit (et tout ce qui est collé) passe par
 * sanitizeNoteHtml avant d'être affiché ou enregistré.
 */
export function NotesPanel({ open, onClose }: NotesPanelProps) {
  const { content, setContent, isSaving } = useNote()
  const { settings: extrasSettings } = useExtrasSettings()
  const panelRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const lastSyncedHtmlRef = useRef<string | null>(null)
  const [plainText, setPlainText] = useState('')

  useEffect(() => {
    if (!open) return
    editorRef.current?.focus()

    const onPointerDownOutside = (event: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDownOutside)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDownOutside)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  // Dépend aussi de `open` : le contenu peut déjà être chargé (useNote) avant que le
  // panneau ne soit ouvert une première fois, auquel cas `content` ne change plus une
  // fois editorRef enfin monté — sans `open` ici, cette synchro initiale n'aurait
  // jamais lieu et la note s'afficherait vide à l'ouverture.
  useEffect(() => {
    if (!open || !editorRef.current) return
    if (lastSyncedHtmlRef.current === content) return
    const safe = sanitizeNoteHtml(content)
    editorRef.current.innerHTML = safe
    lastSyncedHtmlRef.current = safe
    setPlainText(htmlToPlainText(safe))
  }, [content, open])

  if (!open) return null

  // N'écrit jamais dans editor.innerHTML ici : la réécrire pendant la frappe replace le
  // nœud texte sous le curseur et le fait sauter en tête de note à chaque caractère. Le
  // DOM affiché reste la source de vérité (construit uniquement par execCommand, du
  // collage en texte brut et le tirage initial déjà assaini) ; seule la valeur
  // persistée passe par sanitizeNoteHtml.
  const commitFromEditor = () => {
    const editor = editorRef.current
    if (!editor) return
    const safe = sanitizeNoteHtml(editor.innerHTML)
    lastSyncedHtmlRef.current = safe
    setPlainText(htmlToPlainText(safe))
    setContent(safe)
  }

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
    commitFromEditor()
  }

  const handleHeading = () => {
    editorRef.current?.focus()
    const isHeading = document.queryCommandValue('formatBlock').toLowerCase() === 'h3'
    document.execCommand('formatBlock', false, isHeading ? 'p' : 'h3')
    commitFromEditor()
  }

  const handleChecklist = () => {
    const editor = editorRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('insertUnorderedList')

    const selection = window.getSelection()
    const anchor = selection?.anchorNode
    const anchorEl = anchor instanceof Element ? anchor : anchor?.parentElement
    const list = anchorEl?.closest('li')?.closest('ul')
    if (list) {
      list.classList.add('checklist')
      list.querySelectorAll('li').forEach((item) => {
        if (!item.hasAttribute('data-checked')) item.setAttribute('data-checked', 'false')
      })
    }
    commitFromEditor()
  }

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    // Seul le texte brut est accepté au collage : un copier-coller riche depuis une
    // page web pourrait sinon glisser du HTML non maîtrisé dans la note avant même le
    // passage par sanitizeNoteHtml côté affichage.
    event.preventDefault()
    const text = event.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    commitFromEditor()
  }

  const handleEditorClick = (event: MouseEvent<HTMLDivElement>) => {
    const li = (event.target as HTMLElement).closest('li[data-checked]')
    if (!li || !editorRef.current?.contains(li)) return
    const rect = li.getBoundingClientRect()
    if (event.clientX - rect.left > 24) return // clic hors de la case elle-même
    li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')
    commitFromEditor()
  }

  const wordCount = plainText.trim().length === 0 ? 0 : plainText.trim().split(/\s+/).length
  const charCount = plainText.length

  return (
    <FloatingPanel
      panelRef={panelRef}
      mode={extrasSettings.notesDisplayMode}
      title={strings.notes.title}
      closeLabel={strings.notes.close}
      onClose={onClose}
      panelSizeClassName="h-[min(24rem,60vh)] w-[min(22rem,calc(100vw-2rem))]"
      windowSizeClassName="h-[min(80vh,46rem)] w-[min(36rem,calc(100vw-2rem))]"
    >
      <NoteToolbar
        onBold={() => exec('bold')}
        onItalic={() => exec('italic')}
        onHeading={handleHeading}
        onBulletList={() => exec('insertUnorderedList')}
        onChecklist={handleChecklist}
      />

      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={strings.notes.placeholder}
        data-placeholder={strings.notes.placeholder}
        contentEditable
        suppressContentEditableWarning
        onInput={commitFromEditor}
        onPaste={handlePaste}
        onDrop={(event) => event.preventDefault()}
        onClick={handleEditorClick}
        className="note-editor flex-1 overflow-y-auto rounded-xl border border-[var(--line)] bg-transparent p-3 text-sm text-[var(--text)] outline-none transition-colors duration-200 focus:border-[var(--accent)] empty:before:text-[var(--muted)] empty:before:content-[attr(data-placeholder)]"
      />

      <div className="flex items-center justify-between text-xs text-[var(--muted)]">
        <span>
          {wordCount} {strings.notes.words} · {charCount} {strings.notes.characters}
        </span>
        <span>{isSaving ? strings.notes.saving : strings.notes.saved}</span>
      </div>
    </FloatingPanel>
  )
}
