import { Search, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

import { strings } from '@/shared/i18n'

import type { GraphNode } from './build-graph'
import { searchTasks } from './search'

interface ConstellationSearchProps {
  nodes: GraphNode[]
  /** Pilier d'une tâche (nom), pour la liste de résultats. */
  pillarName: (pillarId: string | null) => string
  onClose: () => void
  /** Résultat choisi : sélectionner et centrer. */
  onChoose: (nodeId: string) => void
  /** Ids qui correspondent à la frappe (le graphe estompe les autres). */
  onMatchesChange: (ids: ReadonlySet<string>) => void
}

/**
 * Recherche de tâche (lot 5) : champ + liste de 8 résultats (nom, pastille du pilier, statut),
 * navigation aux flèches, Entrée pour choisir, Échap pour fermer. Combobox accessible.
 */
export function ConstellationSearch({
  nodes,
  pillarName,
  onClose,
  onChoose,
  onMatchesChange,
}: ConstellationSearchProps) {
  const s = strings.constellation.search
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  const outcome = useMemo(() => searchTasks(nodes, query), [nodes, query])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    onMatchesChange(outcome.matchIds)
  }, [outcome, onMatchesChange])

  // Échap ferme la recherche sans fermer la page ni quitter la vue locale.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [onClose])

  // La recherche s'efface avec elle : plus rien d'estompé.
  useEffect(() => () => onMatchesChange(new Set()), [onMatchesChange])

  const results = outcome.results
  const activeIndex = Math.min(active, Math.max(0, results.length - 1))

  return (
    <div className="pointer-events-auto relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-[14px] border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] px-3 backdrop-blur-md focus-within:border-[var(--cst-highlight)]">
        <Search
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          className="shrink-0 text-[var(--cst-label)]"
        />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={query.trim() !== ''}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            results[activeIndex] ? `${listId}-${results[activeIndex].id}` : undefined
          }
          aria-label={s.open}
          placeholder={s.placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && results.length > 0) {
              event.preventDefault()
              setActive((activeIndex + 1) % results.length)
            } else if (event.key === 'ArrowUp' && results.length > 0) {
              event.preventDefault()
              setActive((activeIndex - 1 + results.length) % results.length)
            } else if (event.key === 'Enter' && results[activeIndex]) {
              event.preventDefault()
              onChoose(results[activeIndex].id)
            }
          }}
          className="h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--text)] outline-none focus-visible:outline-none placeholder:text-[var(--cst-label)]"
        />
        <kbd className="hidden rounded border border-[var(--cst-chrome-line)] px-1.5 py-0.5 font-sans text-xs text-[var(--cst-label)] sm:block">
          {s.shortcutHint}
        </kbd>
        <button
          type="button"
          onClick={onClose}
          aria-label={s.close}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--cst-label)] hover:text-[var(--text)]"
        >
          <X size={16} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      {query.trim() !== '' ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={s.resultsLabel}
          className="absolute inset-x-0 top-full mt-1 overflow-hidden rounded-[14px] border border-[var(--cst-chrome-line)] bg-[var(--cst-chrome)] p-1 backdrop-blur-md"
        >
          {results.length === 0 ? (
            <li role="presentation" className="px-3 py-3 text-sm text-[var(--cst-label)]">
              {s.empty}
            </li>
          ) : (
            results.map((result, index) => (
              <li key={result.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`${listId}-${result.id}`}
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onChoose(result.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm ${
                    index === activeIndex ? 'bg-[var(--cst-chrome-line)]' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">{result.label}</span>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-[var(--cst-label)]">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full"
                      style={{ background: result.color }}
                    />
                    {pillarName(result.pillarId)}
                  </span>
                  <span
                    className={`shrink-0 text-xs ${result.done ? 'text-[var(--cst-ok)]' : 'text-[var(--cst-label)]'}`}
                  >
                    {result.done ? s.statusDone : s.statusTodo}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
