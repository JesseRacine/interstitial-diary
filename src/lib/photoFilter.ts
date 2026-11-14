import { type SearchIndex, type TagStat, computeTagStats, runSearch } from '../search/engine'
import { isEmptyQuery, parseQuery, tokenize } from '../search/query'
import { type Entry, entryImages } from './entry'

/*
 * Filtering the Photos tab. It speaks the same language as the search bar (`#trip @sam ~lisbon from:2026-06 last:3m
 * event:"Lisbon trip" tired`), because it IS the search: the entries that match are shown, as their photos. There is no
 * second parser to keep in step (CLAUDE.md rule 7), and every new search filter works here too.
 */

export interface PhotoFilter {
  entries: Entry[] // the entries (with photos) that match, newest first when a query is given
  errors: string[] // filter words the parser did not understand (shown under the box)
  filtered: boolean // false when the query is empty: everything is shown
}

/** The live entries that have at least one photo. */
export const photoEntries = (entries: readonly Entry[]): Entry[] => entries.filter((e) => !e.deleted && entryImages(e).length > 0)

/** How many photos these entries hold in all. */
export const photoCount = (entries: readonly Entry[]): number => entries.reduce((n, e) => n + (e.deleted ? 0 : entryImages(e).length), 0)

/**
 * The entries with photos that match `query` (search syntax; an empty one matches all). Only entries with photos are ever
 * returned, so `-has:image` in the query cannot empty the tab by accident.
 */
export function filterPhotoEntries(query: string, entries: readonly Entry[], index: SearchIndex, now: Date = new Date()): PhotoFilter {
  const withPhotos = photoEntries(entries)
  const q = parseQuery(query, now)
  if (isEmptyQuery(q)) return { entries: withPhotos, errors: q.errors, filtered: false }
  q.hasImages = true
  return { entries: runSearch(q, withPhotos, index, 'newest').map((h) => h.entry), errors: q.errors, filtered: true }
}

/** The most used tags, people and places among entries that have photos (for quick filter chips). */
export function photoTopTags(entries: readonly Entry[], n = 8): TagStat[] {
  return computeTagStats(photoEntries(entries)).slice(0, n)
}

/** The years that have photos, newest first. */
export function photoYears(entries: readonly Entry[]): string[] {
  return [...new Set(photoEntries(entries).map((e) => e.day.slice(0, 4)))].sort().reverse()
}

const YEAR_TOKEN = /^in:(\d{4})$/i

/** The year the query is narrowed to with `in:YYYY` ('' when it is not). */
export function yearOfQuery(query: string): string {
  for (const t of tokenize(query)) {
    const m = t.match(YEAR_TOKEN)
    if (m) return m[1]
  }
  return ''
}

/** The query with its `in:YYYY` token replaced by `in:<year>`, or removed when `year` is ''. Everything else is kept. */
export function setYearOfQuery(query: string, year: string): string {
  const tokens = tokenize(query).filter((t) => !YEAR_TOKEN.test(t))
  if (year) tokens.push(`in:${year}`)
  return tokens.join(' ')
}
