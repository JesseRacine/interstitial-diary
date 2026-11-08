import { Fragment, type ReactNode, useMemo, useState } from 'react'
import { TAG_PATTERN } from '../lib/entry'
import type { TagStat } from '../search/engine'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function highlight(s: string, re: RegExp | null): ReactNode {
  if (!re) return s
  return s.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))
}

/** Entry text with clickable #tags and highlighted search terms. */
export function EntryText({ text, terms, onTag }: { text: string; terms?: string[]; onTag?: (tag: string) => void }) {
  const re = useMemo(() => {
    const t = (terms ?? []).filter(Boolean).sort((a, b) => b.length - a.length)
    return t.length ? new RegExp(`(${t.map(escapeRe).join('|')})`, 'giu') : null
  }, [terms])
  const parts = text.split(new RegExp(`(${TAG_PATTERN.replace('#(', '#(?:')})`, 'u'))
  return (
    <div className="entry-text">
      {parts.map((part, i) =>
        i % 2 ? (
          <button key={i} type="button" className="tag" onClick={() => onTag?.(part.slice(1).replace(/[-/]+$/, '').toLowerCase())}>
            {highlight(part, re)}
          </button>
        ) : (
          <Fragment key={i}>{highlight(part, re)}</Fragment>
        ),
      )}
    </div>
  )
}

/** Tag autocomplete for a text field: suggests known tags while the caret sits after "#partial". */
export function useTagAutocomplete(text: string, caret: number, tagStats: TagStat[]) {
  const [sel, setSel] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const partial = useMemo(() => {
    const m = text.slice(0, caret).match(/(?<![\p{L}\p{N}_&#])#([\p{L}\p{N}_\-/]*)$/u)
    return m ? m[1].toLowerCase() : null
  }, [text, caret])
  const key = `${caret}:${partial}`
  const suggestions =
    partial === null || dismissedAt === key
      ? []
      : tagStats.filter((t) => t.tag.startsWith(partial) && t.tag !== partial).slice(0, 6)
  const index = Math.min(sel, Math.max(0, suggestions.length - 1))

  /** Returns the new text and caret position after inserting the tag. */
  const apply = (tag: string) => {
    const before = text.slice(0, caret).replace(/#[^\s#]*$/, `#${tag} `)
    return { text: before + text.slice(caret).replace(/^\S*/, ''), caret: before.length }
  }

  /** Handle navigation keys; returns the accepted tag if one was chosen. */
  const onKey = (e: React.KeyboardEvent): string | null => {
    if (!suggestions.length) return null
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((index + 1) % suggestions.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((index - 1 + suggestions.length) % suggestions.length) }
    else if (e.key === 'Escape') { e.preventDefault(); setDismissedAt(key) }
    else if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setSel(0); return suggestions[index].tag }
    return null
  }

  return { suggestions, index, apply, onKey }
}

export function Suggestions({ items, index, onPick }: { items: TagStat[]; index: number; onPick: (tag: string) => void }) {
  if (!items.length) return null
  return (
    <ul className="suggestions" role="listbox">
      {items.map((t, i) => (
        <li key={t.tag} role="option" aria-selected={i === index}>
          <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); onPick(t.tag) }}>
            #{t.tag} <span className="muted">{t.count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
