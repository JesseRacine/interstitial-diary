import type { Entry, ImageRef } from './entry'
import { MAX_TITLE, cleanTitle, isRealDay } from './events'

/**
 * Tracking: things to keep an eye on (a product, a film that is coming out). Written in an entry as `+"Dyson V15"`.
 *
 * Like events, a tracked item is not a tag and nothing new is stored: the marker stays in the entry's text exactly as
 * typed, and the list of items is worked out from the text. Photos, sync, search, export and delete are the entry's own.
 * The state is part of the marker, so Star and Done are ordinary edits that sync like any other:
 *
 *   +"Dyson V15"                      tracking
 *   +*"Dyson V15"                     starred (sits at the top of the list)
 *   +x"Dyson V15" (2026-11-20)        done; the bracketed day is optional and is the day it was marked done
 *
 * An entry is one item, by its first marker; further markers stay plain text. See tracking-plan.md.
 *
 * This file only imports types from `entry.ts`, because `entry.ts` imports it back (tags are not read inside titles).
 */

export type TrackingState = 'active' | 'starred' | 'done'

/** Shown in front of a tracked item's title (journal chips and the Tracking page). */
export const TRACKING_ICONS: Record<TrackingState, string> = { active: '📌', starred: '★', done: '✓' }

/** What is written before the quoted title for each state. */
const HEAD: Record<TrackingState, string> = { active: '+', starred: '+*', done: '+x' }

/**
 * `+`, an optional `*` (starred) or `x` (done), then a quote, the title, a closing quote, and for a done item an optional
 * `(YYYY-MM-DD)`. The `+` must start the text or follow whitespace or an opening bracket, so `C++"x"`, `2 + "3"` and an
 * unquoted `+word` are plain text. Quotes may be straight or curly (phone keyboards); a title has no quote marks inside,
 * stays on one line and is at most MAX_TITLE characters (the same rules as an event's title).
 */
const TRACK_RE = new RegExp(`(?<![^\\s(\\[{])\\+([*xX]?)["“]([^"“”\\r\\n]{1,${MAX_TITLE}})["”]([ \\t]*\\((\\d{4}-\\d{2}-\\d{2})\\))?`, 'gu')

/**
 * One tracking marker in a text: `text.slice(start, end)` is the marker as written (with its date, for a done item that
 * has one). `markEnd` is where `+` and the state letter end, `quoteEnd` where the closing quote ends.
 */
export interface TrackingSpan {
  start: number
  end: number // exclusive
  markEnd: number // exclusive: the end of `+`, `+*` or `+x`
  quoteEnd: number // exclusive: the end of `+"title"`, before any date
  title: string // cleaned up
  state: TrackingState
  date?: string // YYYY-MM-DD, only for a done item whose marker carries a real day
}

/** Every tracking marker in the text, in order. A marker whose title is only spaces is not one. */
export function trackingSpans(text: string): TrackingSpan[] {
  const out: TrackingSpan[] = []
  for (const m of text.matchAll(TRACK_RE)) {
    const title = cleanTitle(m[2])
    if (!title) continue
    const state: TrackingState = m[1] === '*' ? 'starred' : m[1] ? 'done' : 'active'
    const markEnd = m.index + 1 + m[1].length
    const quoteEnd = m.index + m[0].length - (m[3]?.length ?? 0)
    // Only a done item has a date; one that is not a real day (2026-02-30), or that follows another state, stays plain text.
    const date = state === 'done' && m[4] && isRealDay(m[4]) ? m[4] : undefined
    out.push({ start: m.index, end: date ? m.index + m[0].length : quoteEnd, markEnd, quoteEnd, title, state, ...(date ? { date } : {}) })
  }
  return out
}

export interface TrackingSegment {
  text: string // exactly as written
  title?: string // set when the segment is a tracking marker: its cleaned-up title
  state?: TrackingState
  date?: string
}

/** Cut text into plain pieces and tracking markers, in order, so the pieces join back into the text. */
export function trackingSegments(text: string): TrackingSegment[] {
  const out: TrackingSegment[] = []
  let last = 0
  for (const s of trackingSpans(text)) {
    if (s.start > last) out.push({ text: text.slice(last, s.start) })
    out.push({ text: text.slice(s.start, s.end), title: s.title, state: s.state, ...(s.date ? { date: s.date } : {}) })
    last = s.end
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** The text with every tracking marker replaced by spaces (same length), so other readers do not look inside titles. */
export function blankTracking(text: string): string {
  let out = ''
  let last = 0
  for (const s of trackingSpans(text)) {
    out += text.slice(last, s.start) + ' '.repeat(s.end - s.start)
    last = s.end
  }
  return out + text.slice(last)
}

/** Check a name typed by the user (the Track form). */
export function parseTrackingTitle(input: string): { title: string } | { error: string } {
  const title = cleanTitle(input)
  if (!title) return { error: 'An item needs a name.' }
  if ([...title].length > MAX_TITLE) return { error: `A name can have at most ${MAX_TITLE} characters.` }
  if (/["“”]/.test(title)) return { error: 'A name cannot contain quote marks (an apostrophe is fine).' }
  return { title }
}

/** The marker to write for a title (already valid, see parseTrackingTitle): `+"Dyson V15"`. */
export function trackingMarker(title: string, state: TrackingState = 'active', date?: string): string {
  return `${HEAD[state]}"${title}"${state === 'done' && date ? ` (${date})` : ''}`
}

/**
 * Change the state of the entry's item, which is its first marker. Only the marker's own characters change (`+`, `+*`,
 * `+x`, and the done date); the title as typed, its quote marks and every other character of the text stay exactly as they
 * were. Becoming done writes ` (doneDate)` after the title when a day is given; leaving done removes that date. Asking
 * for the state it already has, or a text without a marker, returns the text unchanged.
 */
export function setTrackingState(text: string, state: TrackingState, doneDate?: string): string {
  const s = trackingSpans(text)[0]
  if (!s || s.state === state) return text
  const date = state === 'done' && doneDate ? ` (${doneDate})` : ''
  return text.slice(0, s.start) + HEAD[state] + text.slice(s.markEnd, s.quoteEnd) + date + text.slice(s.end)
}

/** The text without the item's marker: the description that goes on the card. */
export function trackingNote(text: string): string {
  const s = trackingSpans(text)[0]
  if (!s) return text.trim()
  const before = text.slice(0, s.start).trimEnd()
  const after = text.slice(s.end).trimStart()
  if (!before || !after) return (before || after).trim()
  return before + (/\n\s*$/.test(text.slice(0, s.start)) ? '\n' : ' ') + after
}

/** One item on the Tracking page: an entry that carries a tracking marker. */
export interface TrackingItem {
  id: string // the entry's id
  title: string
  state: TrackingState
  doneDate?: string // YYYY-MM-DD, when the marker says when it was marked done
  createdAt: number
  day: string // YYYY-MM-DD the entry was written
  note: string // the entry's text without the marker
  image?: ImageRef // the entry's first photo (the Track form allows one; an entry may hold more)
}

type TrackingSource = Pick<Entry, 'id' | 'text' | 'day' | 'createdAt' | 'deleted' | 'images'>

/** Every tracked item in the journal, oldest first (by when its entry was written). Deleted entries are ignored. */
export function computeTracking(entries: readonly TrackingSource[]): TrackingItem[] {
  const out: TrackingItem[] = []
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))) {
    if (e.deleted) continue
    const s = trackingSpans(e.text)[0]
    if (!s) continue
    const image = e.images?.[0]
    out.push({
      id: e.id,
      title: s.title,
      state: s.state,
      ...(s.date ? { doneDate: s.date } : {}),
      createdAt: e.createdAt,
      day: e.day,
      note: trackingNote(e.text),
      ...(image ? { image } : {}),
    })
  }
  return out
}

export type TrackingSort = 'newest' | 'oldest' | 'name'

/** The day an item is ordered by: when it was marked done, if known, otherwise when it was written. */
const orderDay = (i: TrackingItem): string => (i.state === 'done' && i.doneDate ? i.doneDate : i.day)

function compare(sort: TrackingSort): (a: TrackingItem, b: TrackingItem) => number {
  const tie = (a: TrackingItem, b: TrackingItem) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  if (sort === 'name') return (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || tie(a, b)
  const dir = sort === 'newest' ? -1 : 1
  return (a, b) => {
    const x = orderDay(a)
    const y = orderDay(b)
    return dir * (x < y ? -1 : x > y ? 1 : tie(a, b))
  }
}

/**
 * The two lists the Tracking page shows. `active` is every item still being watched, starred ones first (whatever the sort)
 * and then the rest in the chosen order; `done` is the finished ones in the chosen order (newest = marked done most recently).
 */
export function splitTracking(items: readonly TrackingItem[], sort: TrackingSort = 'newest'): { active: TrackingItem[]; done: TrackingItem[] } {
  const by = compare(sort)
  const active = items.filter((i) => i.state !== 'done').sort((a, b) => Number(b.state === 'starred') - Number(a.state === 'starred') || by(a, b))
  const done = items.filter((i) => i.state === 'done').sort(by)
  return { active, done }
}
