import { Fragment, type ReactNode, useMemo, useState } from 'react'
import { tagBeingTyped, tagSegments } from '../lib/entry'
import { eventDateLabel } from '../lib/eventRows'
import { closingQuote, EVENT_ICON, eventBeingTyped, suggestLastEvent } from '../lib/events'
import { markerSegments } from '../lib/markers'
import { displayName, tagKindOf, tagLabel, tagName, tagToken } from '../lib/tagKinds'
import { TRACKING_ICONS } from '../lib/tracking'
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
 * are not clickable. A marker with a date (`!"Jack's party" (2026-05-12)`) also shows it: "🎉 Jack's party · 12 May 2026".
 * `onEvent` gets the event's title (and date, if it has one) and opens its page; without it the event is not clickable.
 * The tracked item's marker (`+"Dyson V15"`, see lib/tracking.ts) shows as "📌 Dyson V15" (★ starred, ✓ done, with its day
 * for a done one); `onTrack` opens it on the Tracking page, and without it the chip is not clickable. Only the first marker
 * of an entry is a chip. Tags inside a title are not clickable.
 */
export function EntryText({ text, terms, onTag, onEvent, onTrack }: {
  text: string
  terms?: string[]
  onTag?: (key: string) => void
  onEvent?: (title: string, date?: string) => void
  onTrack?: () => void
}) {
  const re = useMemo(() => {
    const t = (terms ?? []).filter(Boolean).sort((a, b) => b.length - a.length)
    return t.length ? new RegExp(`(${t.map(escapeRe).join('|')})`, 'giu') : null
  }, [terms])
  return (
    <div className="entry-text">
      {markerSegments(text).map((part, p) => {
        if (part.kind === 'tracking') {
          const label = (
            <>
              <span aria-hidden="true">{TRACKING_ICONS[part.state]}</span> {highlight(part.title, re)}
              {part.date && <span className="event-date"> · {eventDateLabel(part.date, part.date)}</span>}
            </>
          )
          return onTrack ? (
            <button key={p} type="button" className={`tag tag-track ${part.state}`} title={part.text} onClick={onTrack}>{label}</button>
          ) : (
            <span key={p} className={`tag tag-track ${part.state}`} title={part.text}>{label}</span>
          )
        }
        if (part.kind === 'event') {
          const date = part.date
          const label = <><span aria-hidden="true">{EVENT_ICON}</span> {highlight(part.title, re)}{date && <span className="event-date"> · {eventDateLabel(date, date)}</span>}</>
          const title = part.title
          return onEvent ? (
            <button key={p} type="button" className="tag tag-event" title={part.text} onClick={() => onEvent(title, date)}>{label}</button>
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
 * One line in a suggestion list: `tag` is what picking it hands back; `label` (if set) is shown instead of the tag, and
 * `note` (if set) instead of the count.
 */
export interface SuggestionItem { tag: string; count?: number; label?: string; note?: string }

/** Event suggestions carry this in front of the title, so `apply` can tell them from tags. */
const EVENT_PICK = '!event:'

/**
 * Autocomplete for a text field: suggests known tags of the kind being typed while the caret sits after a symbol
 * and what has been typed of the name ("#wo", "@sa", "~ho"). Items and keys are stored keys (`work`, `@sarah`).
 * Given `lastEvent` (the last event's title), it offers that title while an event is being typed and it still fits
 * (`!"Ja`, lib/events.ts); picking it closes the quote. No other event titles are offered.
 */
export function useTagAutocomplete(text: string, caret: number, tagStats: TagStat[], lastEvent?: string) {
  const [sel, setSel] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<string | null>(null)
  const eventTyping = useMemo(() => (lastEvent ? eventBeingTyped(text.slice(0, caret)) : null), [lastEvent, text, caret])
  // Inside an event title a `#` or `@` is part of the title, so tags are only looked for outside one.
  const typing = useMemo(() => (eventTyping ? null : tagBeingTyped(text.slice(0, caret))), [eventTyping, text, caret])
  const key = eventTyping ? `${caret}:!${eventTyping.partial}` : typing ? `${caret}:${typing.kind.sigil}${typing.partial}` : null
  const suggestions: SuggestionItem[] =
    dismissedAt === key
      ? []
      : eventTyping
        ? suggestLastEvent(eventTyping.partial, lastEvent)
          ? [{ tag: EVENT_PICK + lastEvent, label: `${EVENT_ICON} ${lastEvent}`, note: 'last event' }]
          : []
        : !typing
          ? []
          : tagStats
              .filter((t) => tagKindOf(t.tag) === typing.kind && tagName(t.tag).startsWith(typing.partial) && tagName(t.tag) !== typing.partial)
              .slice(0, 6)
  const index = Math.min(sel, Math.max(0, suggestions.length - 1))

  /** Returns the new text and caret position after inserting the tag (or event title). */
  const apply = (tag: string) => {
    if (tag.startsWith(EVENT_PICK) && eventTyping) {
      const rest = text.slice(caret).replace(/^["”]/, '') // a closing quote the keyboard already added
      const before = `${text.slice(0, eventTyping.start)}!${eventTyping.open}${tag.slice(EVENT_PICK.length)}${closingQuote(eventTyping.open)}${/^\s/.test(rest) ? '' : ' '}`
      return { text: before + rest, caret: before.length }
    }
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

export function Suggestions({ items, index, onPick }: { items: readonly SuggestionItem[]; index: number; onPick: (tag: string) => void }) {
  if (!items.length) return null
  return (
    <ul className="suggestions" role="listbox">
      {items.map((t, i) => (
        <li key={t.tag} role="option" aria-selected={i === index}>
          <button type="button" tabIndex={-1} onMouseDown={(e) => { e.preventDefault(); onPick(t.tag) }}>
            {t.label ?? tagLabel(t.tag)} <span className="muted">{t.note ?? t.count}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
