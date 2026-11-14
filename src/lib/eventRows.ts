import { MONTH_NAMES, parseDayKey } from './entry'
import { type EventStat, dayNumber } from './events'

/** What the Events page lists, filtered, sorted and grouped: pure functions so they can be tested. */

export type EventSort = 'newest' | 'oldest' | 'name'

const mon = (d: Date) => MONTH_NAMES[d.getMonth()].slice(0, 3)

/** "13 Nov 2026", "8–10 Nov 2026", "30 Nov – 2 Dec 2026" or "30 Dec 2026 – 2 Jan 2027". */
export function eventDateLabel(first: string, last: string): string {
  const a = parseDayKey(first)
  const b = parseDayKey(last)
  const one = `${a.getDate()} ${mon(a)} ${a.getFullYear()}`
  if (first === last) return one
  if (a.getFullYear() !== b.getFullYear()) return `${one} – ${b.getDate()} ${mon(b)} ${b.getFullYear()}`
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${mon(a)} – ${b.getDate()} ${mon(b)} ${a.getFullYear()}`
  return `${a.getDate()}–${b.getDate()} ${mon(a)} ${a.getFullYear()}`
}

/** The years that have an event (by the day it started), newest first. */
export const eventYears = (events: readonly EventStat[]): string[] =>
  [...new Set(events.map((e) => e.first.slice(0, 4)))].sort().reverse()

/** Events whose title contains the text (case does not matter), and that started in the year if one is given. */
export function filterEvents(events: readonly EventStat[], text: string, year: string | null): EventStat[] {
  const f = text.trim().toLowerCase()
  return events.filter((e) => (!year || e.first.startsWith(year)) && (!f || e.title.toLowerCase().includes(f)))
}

const byId = (a: EventStat, b: EventStat) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function sortEvents(events: readonly EventStat[], sort: EventSort): EventStat[] {
  const l = [...events]
  if (sort === 'name') return l.sort((a, b) => a.title.localeCompare(b.title) || a.first.localeCompare(b.first) || byId(a, b))
  const dir = sort === 'newest' ? -1 : 1
  return l.sort((a, b) => dir * (a.first.localeCompare(b.first) || a.last.localeCompare(b.last)) || byId(a, b))
}

/** Whole days between two events' date ranges (0 when they overlap or touch). */
export function eventGap(a: EventStat, b: EventStat): number {
  return Math.max(0, dayNumber(a.first) - dayNumber(b.last), dayNumber(b.first) - dayNumber(a.last))
}

/**
 * The events `event` could be merged into: every event with a different title (the same title in another year is
 * already the same name, merging would change nothing), nearest in time first, because a misspelt title is usually
 * written about around the same days as the right one. Ties go by title.
 */
export function mergeTargets(events: readonly EventStat[], event: EventStat): EventStat[] {
  return events
    .filter((e) => e.id !== event.id && e.key !== event.key)
    .map((e) => ({ e, gap: eventGap(event, e) }))
    .sort((a, b) => a.gap - b.gap || a.e.title.localeCompare(b.e.title) || byId(a.e, b.e))
    .map(({ e }) => e)
}

export interface EventGroup {
  key: string // YYYY-MM, or 'all'
  label: string // "November 2026", or '' for the one group of an A–Z list
  events: EventStat[]
}

/** Split an already sorted list into months of the day each event started; A–Z stays one group. */
export function groupEvents(sorted: readonly EventStat[], sort: EventSort): EventGroup[] {
  if (sort === 'name') return sorted.length ? [{ key: 'all', label: '', events: [...sorted] }] : []
  const out: EventGroup[] = []
  for (const e of sorted) {
    const key = e.first.slice(0, 7)
    let g = out.find((x) => x.key === key)
    if (!g) {
      g = { key, label: `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`, events: [] }
      out.push(g)
    }
    g.events.push(e)
  }
  return out
}
