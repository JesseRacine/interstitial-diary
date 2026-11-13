import { computeTagStats } from '../search/engine'
import { type Entry, addDays, entryImages, parseDayKey } from './entry'
import type { EventStat } from './events'
import { TAG_KINDS, type TagKind, tagKindOf } from './tagKinds'

/*
 * The weekly review: what a Monday-to-Sunday week held. Everything is worked out from the entries (nothing is stored),
 * so it is always up to date and needs no sync. Monday first, like the calendar.
 */

/** Parts of the day, by the hour an entry was written (local time). */
export const TIME_BANDS = [
  { id: 'night', label: 'Night', hours: '0–6', from: 0, to: 6 },
  { id: 'morning', label: 'Morning', hours: '6–12', from: 6, to: 12 },
  { id: 'afternoon', label: 'Afternoon', hours: '12–18', from: 12, to: 18 },
  { id: 'evening', label: 'Evening', hours: '18–24', from: 18, to: 24 },
] as const

export interface DayCount {
  day: string // YYYY-MM-DD
  count: number
}

export interface BandCount {
  id: (typeof TIME_BANDS)[number]['id']
  label: string
  hours: string
  count: number
}

/** The most used tags (or people, or places) of the week. */
export interface TopOfKind {
  kind: TagKind
  items: { tag: string; count: number }[] // stored keys, most used first
}

/** An event that has an entry in the week; `count` is how many of this week's entries are in it. */
export interface WeekEvent {
  id: string
  title: string
  first: string // the whole event's first and last day (it may start before or end after this week)
  last: string
  count: number
}

export interface WeekReview {
  start: string // the Monday
  end: string // the Sunday
  days: DayCount[] // Monday to Sunday
  total: number
  activeDays: number
  previousTotal: number // entries in the week before, to compare
  busiest: DayCount | null // the day with most entries (the earliest if tied); null for an empty week
  photos: number
  bands: BandCount[]
  top: TopOfKind[] // only kinds that have something
  events: WeekEvent[] // oldest first
}

/** "+3 vs last week", "−2 vs last week", "Same as last week"; empty when neither week has entries. */
export function compareLabel(total: number, previousTotal: number): string {
  if (total === 0 && previousTotal === 0) return ''
  const diff = total - previousTotal
  if (diff === 0) return 'Same as last week'
  return `${diff > 0 ? '+' : '−'}${Math.abs(diff)} vs last week`
}

/** The Monday of the week that contains `day` (YYYY-MM-DD). */
export function weekStart(day: string): string {
  const back = (parseDayKey(day).getDay() + 6) % 7
  return addDays(day, -back)
}

/**
 * Review the week that starts on Monday `start`. `entries` may include deleted ones (ignored). `events` is the list
 * of all events in the journal (`computeEvents`); the ones with an entry this week are listed.
 */
export function buildWeekReview(entries: readonly Entry[], start: string, events: readonly EventStat[], topN = 5): WeekReview {
  const end = addDays(start, 6)
  const prevStart = addDays(start, -7)
  const days: DayCount[] = Array.from({ length: 7 }, (_, i) => ({ day: addDays(start, i), count: 0 }))
  const index = new Map(days.map((d, i) => [d.day, i]))

  const week: Entry[] = []
  let previousTotal = 0
  for (const e of entries) {
    if (e.deleted) continue
    const i = index.get(e.day)
    if (i !== undefined) {
      days[i].count++
      week.push(e)
    } else if (e.day >= prevStart && e.day < start) {
      previousTotal++
    }
  }

  const bands: BandCount[] = TIME_BANDS.map((b) => ({ id: b.id, label: b.label, hours: b.hours, count: 0 }))
  let photos = 0
  for (const e of week) {
    const band = TIME_BANDS.findIndex((b) => e.hour >= b.from && e.hour < b.to)
    if (band >= 0) bands[band].count++
    photos += entryImages(e).length
  }

  const stats = computeTagStats(week) // most used first
  const top: TopOfKind[] = TAG_KINDS.map((kind) => ({
    kind,
    items: stats.filter((s) => tagKindOf(s.tag) === kind).slice(0, topN).map((s) => ({ tag: s.tag, count: s.count })),
  })).filter((t) => t.items.length > 0)

  const ids = new Set(week.map((e) => e.id))
  const weekEvents: WeekEvent[] = events
    .map((ev) => ({ ev, count: ev.entryIds.filter((id) => ids.has(id)).length }))
    .filter(({ count }) => count > 0)
    .map(({ ev, count }) => ({ id: ev.id, title: ev.title, first: ev.first, last: ev.last, count }))

  const busiest = days.reduce<DayCount | null>((best, d) => (d.count > (best?.count ?? 0) ? d : best), null)

  return {
    start,
    end,
    days,
    total: week.length,
    activeDays: days.filter((d) => d.count > 0).length,
    previousTotal,
    busiest,
    photos,
    bands,
    top,
    events: weekEvents,
  }
}
