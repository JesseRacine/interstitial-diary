import { Fragment, type ReactNode, useMemo, useState } from 'react'
import { tagBeingTyped, tagSegments } from '../lib/entry'
import { EVENT_ICON, eventSegments } from '../lib/events'
import { displayName, tagKindOf, tagLabel, tagName, tagToken } from '../lib/tagKinds'
import type { TagStat } from '../search/engine'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function highlight(s: string, re: RegExp | null): ReactNode {
  if (!re) return s
  return s.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : <Fragment key={i}>{part}</Fragment>))
}

/**
 * Entry text with clickable tags and highlighted search terms. `onTag` gets the tag's stored key (`work`, `@sarah`).
 * People and places show as an icon and a name ("👤 Sarah Jones"); the text as written is in the tooltip.
 * Events (`!"Jack's party"`, see lib/events.ts) show as "🎉 Jack's party"; they are not tags, so tags inside a title
 * are not clickable. `onEvent` gets the event's title and opens its page; without it the event is not clickable.
 */
export function EntryText({ text, terms, onTag, onEvent }: { text: string; terms?: string[]; onTag?: (key: string) => void; onEvent?: (title: string) => void }) {
  const re = useMemo(() => {
    const t = (terms ?? []).filter(Boolean).sort((a, b) => b.length - a.length)
    return t.length ? new RegExp(`(${t.map(escapeRe).join('|')})`, 'giu') : null
  }, [terms])
  return (
    <div className="entry-text">
      {eventSegments(text).map((part, p) => {
        if (part.title !== undefined) {
          const label = <><span aria-hidden="true">{EVENT_ICON}</span> {highlight(part.title, re)}</>
          const title = part.title
          return onEvent ? (
            <button key={p} type="button" className="tag tag-event" title={part.text} onClick={() => onEvent(title)}>{label}</button>
          ) : (
            <span key={p} className="tag tag-event" title={part.text}>{label}</span>
          )
        }
        return tagSegments(part.text).map((seg, i) => {
          if (seg.key === undefined) return <Fragment key={`${p}.${i}`}>{highlight(seg.text, re)}</Fragment>
          const kind = tagKindOf(seg.key)
          return (
            <button key={`${p}.${i}`} type="button" className={kind.className} title={kind.pretty ? seg.text : undefined} onClick={() => onTag?.(seg.key!)}>
              {kind.pretty ? <><span aria-hidden="true">{kind.icon}</span> {highlight(displayName(seg.key), re)}</> : highlight(seg.text, re)}
            </button>
          )
        })
      })}
    </div>
  )
}

/**
 * Tag autocomplete for a text field: suggests known tags of the kind being typed while the caret sits after a symbol
 * and what has been typed of the name ("#wo", "@sa", "~ho"). Items and keys are stored keys (`work`, `@sarah`).
 */
export function useTagAutocomplete(text: string, caret: number, tagStats: TagStat[]) {
  const [sel, setSel] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const typing = useMemo(() => tagBeingTyped(text.slice(0, caret)), [text, caret])
  const key = typing ? `${caret}:${typing.kind.sigil}${typing.partial}` : null
  const suggestions =
    !typing || dismissedAt === key
      ? []
      : tagStats
          .filter((t) => tagKindOf(t.tag) === typing.kind && tagName(t.tag).startsWith(typing.partial) && tagName(t.tag) !== typing.partial)
          .slice(0, 6)
  const index = Math.min(sel, Math.max(0, suggestions.length - 1))

  /** Returns the new text and caret position after inserting the tag. */
  const apply = (tag: string) => {
    const before = (typing ? text.slice(0, typing.start) : text.slice(0, caret)) + `${tagToken(tag)} `
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
            {tagLabel(t.tag)} <span className="muted">{t.count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
