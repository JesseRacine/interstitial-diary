import type { Entry } from './entry'

/** A day with at least one entry; `index` is the row index of its header. */
export interface DayMark { day: string; index: number; count: number }

export type Row =
  | { kind: 'day'; day: string; count: number }
  | { kind: 'entry'; entry: Entry; day: string; gapMinutes: number | null; last: boolean }

export interface Rows { rows: Row[]; days: DayMark[] }

/**
 * Flatten entries (any order) into chat rows, oldest first: a header row per day followed by that day's entries.
 * One flat list is what lets the journal be virtualised, so only the rows on screen exist in the DOM.
 * `gapMinutes` is the time since the previous entry on the same day (null for the first entry of a day).
 */
export function buildRows(entries: Entry[]): Rows {
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1))
  const rows: Row[] = []
  const days: DayMark[] = []
  let current: DayMark | null = null
  let prev: Entry | null = null
  for (const e of sorted) {
    if (!current || current.day !== e.day) {
      current = { day: e.day, index: rows.length, count: 0 }
      days.push(current)
      rows.push({ kind: 'day', day: e.day, count: 0 })
      prev = null
    }
    current.count++
    rows.push({ kind: 'entry', entry: e, day: e.day, gapMinutes: prev ? (e.createdAt - prev.createdAt) / 60000 : null, last: false })
    prev = e
  }
  // Fill in the per-day counts and mark each day's last entry (used to round off a day card).
  for (let i = 0; i < days.length; i++) {
    const header = rows[days[i].index]
    if (header.kind === 'day') header.count = days[i].count
    const lastRow = rows[days[i].index + days[i].count]
    if (lastRow.kind === 'entry') lastRow.last = true
  }
  return { rows, days }
}

/** Row index of the entry with this id, or -1. */
export function rowOfEntry(rows: Row[], id: string): number {
  return rows.findIndex((r) => r.kind === 'entry' && r.entry.id === id)
}

/** The first day that has entries on or after `day` (YYYY-MM-DD sorts as text); null if there is none. */
export function dayOnOrAfter(days: DayMark[], day: string): DayMark | null {
  return days.find((d) => d.day >= day) ?? null
}

/** The day mark that contains the given row index. */
export function dayAtRow(days: DayMark[], rowIndex: number): DayMark | null {
  let found: DayMark | null = null
  for (const d of days) {
    if (d.index <= rowIndex) found = d
    else break
  }
  return found
}
