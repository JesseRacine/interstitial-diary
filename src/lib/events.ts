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

/** Shown in front of an event's title. */
export const EVENT_ICON = '🎉'

/** How many days may pass between two entries with the same title for them to still be one event. */
export const SAME_EVENT_DAYS = 7

/**
 * `!` then a quote, the title, a closing quote. The `!` must start the text or follow whitespace or an opening bracket, so
 * `he said "stop!" and "go"` and `"What?!" she said, "no"` are not events. Quotes may be straight or curly (phone keyboards).
 * A title has no quote marks inside it (an apostrophe is fine), stays on one line and is at most MAX_TITLE characters.
 */
const EVENT_RE = new RegExp(`(?<![^\\s(\\[{])!["“]([^"“”\\r\\n]{1,${MAX_TITLE}})["”]([ \\t]*\\((\\d{4}-\\d{2}-\\d{2})\\))?`, 'gu')

/** The marker may be followed by the day the event happened, in brackets: `!"Jack's 40th" (2026-05-12)`. */
const isRealDay = (k: string): boolean => {
  const [y, m, d] = k.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

/**
 * One event marker in a text: `text.slice(start, end)` is the marker as written (with its date, if it has one),
 * `title` the cleaned-up title. `quoteEnd` is where the closing quote ends (the date, if any, comes after it).
 */
export interface EventSpan {
  start: number
  end: number // exclusive
  quoteEnd: number // exclusive: the end of `!"title"`, before any date
  title: string
  date?: string // YYYY-MM-DD: when the event happened, if the marker says so (and it is a real day)
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
    if (!title) continue
    const quoteEnd = m.index + m[0].length - (m[2]?.length ?? 0)
    // A date that is not a real day (2026-02-30) is not one: it stays plain text after the marker.
    const date = m[3] && isRealDay(m[3]) ? m[3] : undefined
    out.push({ start: m.index, end: date ? m.index + m[0].length : quoteEnd, quoteEnd, title, ...(date ? { date } : {}) })
  }
  return out
}

export interface EventSegment {
  text: string // exactly as written
  title?: string // set when the segment is an event marker: its cleaned-up title
  date?: string // set when the marker carries the day the event happened
}

/** Cut text into plain pieces and event markers, in order, so the pieces join back into the text. */
export function eventSegments(text: string): EventSegment[] {
  const out: EventSegment[] = []
  let last = 0
  for (const s of eventSpans(text)) {
    if (s.start > last) out.push({ text: text.slice(last, s.start) })
    out.push({ text: text.slice(s.start, s.end), title: s.title, ...(s.date ? { date: s.date } : {}) })
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
 * Give every marker with this key a new title, keeping the quote marks the person typed and any date after the marker.
 * `newTitle` must already be valid (see parseEventTitle). Everything else in the text stays exactly as it was.
 */
export function renameEventInText(text: string, key: string, newTitle: string): string {
  let out = ''
  let last = 0
  for (const s of eventSpans(text)) {
    if (eventKey(s.title) !== key) continue
    const open = text.charAt(s.start + 1)
    const close = text.charAt(s.quoteEnd - 1)
    out += `${text.slice(last, s.start)}!${open}${newTitle}${close}`
    last = s.quoteEnd // the date (if any) after it is left as written
  }
  return out + text.slice(last)
}

/**
 * The event `event` becomes once its entries carry `newTitle`, found by running computeEvents on the renamed texts (it
 * may join a neighbouring event of the same title, so its id can differ from a guess). Undefined only if the new
 * title is not valid. Used to keep the event page open after a rename, before the database has caught up.
 */
export function eventAfterRename(entries: readonly EventSource[], event: EventStat, newTitle: string): EventStat | undefined {
  const ids = new Set(event.entryIds)
  const renamed = entries.map((e) => (ids.has(e.id) ? { ...e, text: renameEventInText(e.text, event.key, newTitle) } : e))
  const key = eventKey(newTitle)
  return computeEvents(renamed).find((x) => x.key === key && x.date === event.date && x.entryIds.includes(event.entryIds[0]))
}

/**
 * One event on the Events page: entries that carry the same title on days close together, or the same title and the
 * same date (`!"Title" (2026-05-12)`).
 */
export interface EventStat {
  id: string // title key (+ the date, if it has one) + the first entry's id; stable while that entry exists
  key: string // eventKey of the title
  title: string // as written in the event's earliest entry
  count: number // entries
  date?: string // YYYY-MM-DD: the day the entries say it happened; set only for an event with its own date
  first: string // YYYY-MM-DD of the earliest entry; for an event with its own date, that date
  last: string // YYYY-MM-DD of the latest entry; for an event with its own date, that date
  entryIds: string[] // oldest first
}

/** Whole days since 1970 for a YYYY-MM-DD key, so differences ignore daylight saving. */
export const dayNumber = (k: string): number => {
  const [y, m, d] = k.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86_400_000
}

type EventSource = Pick<Entry, 'id' | 'text' | 'day' | 'createdAt' | 'deleted'>


/**
 * The event that a marker in an entry belongs to (the one whose entries include it): for a marker with a date, the event
 * of that date; otherwise the first one with that title. Undefined if the entry is in no such event.
 */
export function eventOfMarker(events: readonly EventStat[], entryId: string, title: string, date?: string): EventStat | undefined {
  const key = eventKey(title)
  const mine = events.filter((ev) => ev.key === key && ev.entryIds.includes(entryId))
  return (date ? mine.find((ev) => ev.date === date) : undefined) ?? mine[0]
}

type Member = { title: string; e: EventSource }

const byWritten = (a: Member, b: Member) => a.e.createdAt - b.e.createdAt || (a.e.id < b.e.id ? -1 : a.e.id > b.e.id ? 1 : 0)

/**
 * All events in the journal, oldest first (by when its first entry was written). Deleted entries are ignored.
 *
 * Without a date, entries with the same title belong to one event while each is within SAME_EVENT_DAYS days of the one
 * before; a longer gap starts a new event with the same title, so the same birthday a year later is its own event and
 * nobody has to put a year in the title.
 *
 * A marker with a date (`!"Title" (2026-05-12)`) names its event exactly: the same title and date is one event however
 * far apart the entries were written, and a different date is a different event. The event's day is that date. A marker
 * without a date joins the dated event of the same title whose date is nearest to the day the entry was written, if
 * that is within SAME_EVENT_DAYS days; otherwise it follows the rule above. An entry counts once per event, and an entry
 * that names a dated event is not also counted in an undated event of the same title.
 */
export function computeEvents(entries: readonly EventSource[]): EventStat[] {
  const byKey = new Map<string, { dated: Map<string, Member[]>; undated: Member[] }>()
  for (const e of [...entries].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))) {
    if (e.deleted) continue
    const spans = eventSpans(e.text)
    const hasDate = new Set(spans.filter((s) => s.date).map((s) => eventKey(s.title))) // titles this entry dates
    const seen = new Set<string>() // one entry counts once per title and date, however many times it writes it
    for (const s of spans) {
      const key = eventKey(s.title)
      if (!s.date && hasDate.has(key)) continue
      const id = `${key}|${s.date ?? ''}`
      if (seen.has(id)) continue
      seen.add(id)
      let g = byKey.get(key)
      if (!g) byKey.set(key, (g = { dated: new Map(), undated: [] }))
      const m: Member = { title: s.title, e }
      if (s.date) {
        const list = g.dated.get(s.date)
        if (list) list.push(m)
        else g.dated.set(s.date, [m])
      } else g.undated.push(m)
    }
  }

  const out: { stat: EventStat; at: number }[] = [] // `at`: when its first entry was written, to order them
  for (const [key, g] of byKey) {
    const dated = [...g.dated].map(([date, members]) => ({ date, members })).sort((a, b) => (a.date < b.date ? -1 : 1))
    const rest: Member[] = [] // undated markers that did not join a dated event
    for (const m of g.undated) {
      let best: (typeof dated)[number] | null = null
      let bestGap = Infinity
      for (const d of dated) {
        const gap = Math.abs(dayNumber(m.e.day) - dayNumber(d.date))
        if (gap <= SAME_EVENT_DAYS && gap < bestGap) { best = d; bestGap = gap }
      }
      if (best) best.members.push(m)
      else rest.push(m)
    }

    for (const { date, members } of dated) {
      members.sort(byWritten)
      const first = members[0]
      out.push({
        stat: { id: `${key}|${date}|${first.e.id}`, key, title: first.title, count: members.length, date, first: date, last: date, entryIds: members.map((x) => x.e.id) },
        at: first.e.createdAt,
      })
    }

    let cur: EventStat | null = null
    for (const { title, e } of rest) {
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
