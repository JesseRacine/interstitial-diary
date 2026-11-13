import type { Entry } from './entry'

/**
 * Events: the name of something that happened, written in an entry as `!"Jack's 40th birthday"`.
 *
 * An event is not a tag. A tag is a label you reuse; an event title is mostly used once (or a few times around the
 * same days), so events have no autocomplete, no counts of "most used" and no rename-everywhere. Nothing new is stored:
 * the marker stays in the entry's text exactly as typed, and the list of events is worked out from the text.
 *
 * This file only imports a type from `entry.ts`, because `entry.ts` imports it back (tags are not read inside titles).
 */

export const MAX_TITLE = 120

/** How many days may pass between two entries with the same title for them to still be one event. */
export const SAME_EVENT_DAYS = 7

/**
 * `!` then a quote, the title, a closing quote. The `!` must start the text or follow whitespace or an opening bracket, so
 * `he said "stop!" and "go"` and `"What?!" she said, "no"` are not events. Quotes may be straight or curly (phone keyboards).
 * A title has no quote marks inside it (an apostrophe is fine), stays on one line and is at most MAX_TITLE characters.
 */
const EVENT_RE = new RegExp(`(?<![^\\s(\\[{])!["“]([^"“”\\r\\n]{1,${MAX_TITLE}})["”]`, 'gu')

/** One event marker in a text: `text.slice(start, end)` is the marker as written, `title` the cleaned-up title. */
export interface EventSpan {
  start: number
  end: number // exclusive
  title: string
}

/** Collapse runs of whitespace and trim: `  Jack's   party ` gives "Jack's party". */
export const cleanTitle = (t: string): string => t.replace(/\s+/g, ' ').trim()

/** What makes two titles the same event name: spacing and capital letters do not matter. */
export const eventKey = (title: string): string => cleanTitle(title).toLowerCase()

/** Every event marker in the text, in order. A marker whose title is only spaces is not one. */
export function eventSpans(text: string): EventSpan[] {
  const out: EventSpan[] = []
  for (const m of text.matchAll(EVENT_RE)) {
    const title = cleanTitle(m[1])
    if (title) out.push({ start: m.index, end: m.index + m[0].length, title })
  }
  return out
}

export interface EventSegment {
  text: string // exactly as written
  title?: string // set when the segment is an event marker: its cleaned-up title
}

/** Cut text into plain pieces and event markers, in order, so the pieces join back into the text. */
export function eventSegments(text: string): EventSegment[] {
  const out: EventSegment[] = []
  let last = 0
  for (const s of eventSpans(text)) {
    if (s.start > last) out.push({ text: text.slice(last, s.start) })
    out.push({ text: text.slice(s.start, s.end), title: s.title })
    last = s.end
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out
}

/** The text with every event marker replaced by spaces (same length), so other readers do not look inside titles. */
export function blankEvents(text: string): string {
  let out = ''
  let last = 0
  for (const s of eventSpans(text)) {
    out += text.slice(last, s.start) + ' '.repeat(s.end - s.start)
    last = s.end
  }
  return out + text.slice(last)
}

/** Check a title typed by the user (for rename). */
export function parseEventTitle(input: string): { title: string } | { error: string } {
  const title = cleanTitle(input)
  if (!title) return { error: 'An event needs a title.' }
  if ([...title].length > MAX_TITLE) return { error: `A title can have at most ${MAX_TITLE} characters.` }
  if (/["“”]/.test(title)) return { error: 'A title cannot contain quote marks (an apostrophe is fine).' }
  return { title }
}

/**
 * Give every marker with this key a new title, keeping the quote marks the person typed. `newTitle` must already be
 * valid (see parseEventTitle). Everything else in the text stays exactly as it was.
 */
export function renameEventInText(text: string, key: string, newTitle: string): string {
  let out = ''
  let last = 0
  for (const s of eventSpans(text)) {
    if (eventKey(s.title) !== key) continue
    const open = text.charAt(s.start + 1)
    const close = text.charAt(s.end - 1)
    out += `${text.slice(last, s.start)}!${open}${newTitle}${close}`
    last = s.end
  }
  return out + text.slice(last)
}

/** One event on the Events page: entries that carry the same title on days close together. */
export interface EventStat {
  id: string // title key + the first entry's id; stable while that entry exists
  key: string // eventKey of the title
  title: string // as written in the event's earliest entry
  count: number // entries
  first: string // YYYY-MM-DD of the earliest entry
  last: string // YYYY-MM-DD of the latest entry
  entryIds: string[] // oldest first
}

/** Whole days since 1970 for a YYYY-MM-DD key, so differences ignore daylight saving. */
const dayNumber = (k: string): number => {
  const [y, m, d] = k.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

type EventSource = Pick<Entry, 'id' | 'text' | 'day' | 'createdAt' | 'deleted'>

/**
 * All events in the journal, oldest first. Entries with the same title belong to one event while each is within
 * SAME_EVENT_DAYS days of the one before; a longer gap starts a new event with the same title, so the same birthday
 * a year later is its own event and nobody has to put a year in the title. Deleted entries are ignored.
 */
export function computeEvents(entries: readonly EventSource[]): EventStat[] {
  const byKey = new Map<string, { title: string; e: EventSource }[]>()
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))) {
    if (e.deleted) continue
    const seen = new Set<string>() // one entry counts once per title, however many times it writes it
    for (const s of eventSpans(e.text)) {
      const key = eventKey(s.title)
      if (seen.has(key)) continue
      seen.add(key)
      const list = byKey.get(key)
      if (list) list.push({ title: s.title, e })
      else byKey.set(key, [{ title: s.title, e }])
    }
  }

  const out: { stat: EventStat; at: number }[] = [] // `at`: when its first entry was written, to order them
  for (const [key, list] of byKey) {
    let cur: EventStat | null = null
    for (const { title, e } of list) {
      if (cur && dayNumber(e.day) - dayNumber(cur.last) <= SAME_EVENT_DAYS) {
        cur.count++
        cur.last = e.day
        cur.entryIds.push(e.id)
      } else {
        cur = { id: `${key}|${e.id}`, key, title, count: 1, first: e.day, last: e.day, entryIds: [e.id] }
        out.push({ stat: cur, at: e.createdAt })
      }
    }
  }
  return out.sort((a, b) => a.at - b.at || (a.stat.id < b.stat.id ? -1 : 1)).map((o) => o.stat)
}
