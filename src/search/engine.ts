import MiniSearch from 'minisearch'
import type { Entry } from '../lib/entry'
import type { ParsedQuery } from './query'

export type SearchIndex = MiniSearch<Entry>
export type SortMode = 'relevance' | 'newest' | 'oldest'

export interface Hit {
  entry: Entry
  score: number
  terms: string[] // words to highlight
}

export function buildIndex(entries: Entry[]): SearchIndex {
  const ms = new MiniSearch<Entry>({ fields: ['text'], storeFields: [], idField: 'id' })
  ms.addAll(entries.filter((e) => !e.deleted))
  return ms
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function containsWord(textLower: string, word: string): boolean {
  if (word.includes(' ')) return textLower.includes(word)
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRe(word)}(?![\\p{L}\\p{N}_])`, 'u').test(textLower)
}

function inTimeWindow(minute: number, from: number, to: number): boolean {
  return from <= to ? minute >= from && minute < to : minute >= from || minute < to
}

export function runSearch(q: ParsedQuery, entries: Entry[], index: SearchIndex, sort: SortMode = 'relevance'): Hit[] {
  let scored: Map<string, { score: number; terms: string[] }> | null = null
  if (q.terms.length) {
    scored = new Map()
    const results = index.search(q.terms.join(' '), {
      combineWith: 'AND',
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
    })
    for (const r of results) scored.set(String(r.id), { score: r.score, terms: r.terms })
  }

  const hits: Hit[] = []
  for (const e of entries) {
    if (e.deleted) continue
    if (q.from && e.day < q.from) continue
    if (q.to && e.day > q.to) continue
    if (q.timeFrom !== undefined && q.timeTo !== undefined && !inTimeWindow(e.minute, q.timeFrom, q.timeTo)) continue
    if (q.weekdays && !q.weekdays.includes(e.weekday)) continue
    if (q.hasImages !== undefined && q.hasImages !== !!e.images?.length) continue
    if (!q.tags.every((t) => e.tags.includes(t))) continue
    if (!q.anyTags.every((g) => g.some((t) => e.tags.includes(t)))) continue
    if (q.excludeTags.some((t) => e.tags.includes(t))) continue

    let s: { score: number; terms: string[] } | undefined
    if (scored) {
      s = scored.get(e.id)
      if (!s) continue
    }
    const lower = e.text.toLowerCase()
    if (!q.phrases.every((p) => lower.includes(p))) continue
    if (q.excludeTerms.some((w) => containsWord(lower, w))) continue

    hits.push({ entry: e, score: s?.score ?? 0, terms: [...(s?.terms ?? []), ...q.phrases] })
  }

  const byDate = (a: Hit, b: Hit) => b.entry.createdAt - a.entry.createdAt
  if (sort === 'oldest') hits.sort((a, b) => -byDate(a, b))
  else if (sort === 'newest' || !scored) hits.sort(byDate)
  else hits.sort((a, b) => b.score - a.score || byDate(a, b))
  return hits
}

export interface TagStat {
  tag: string // stored key: `work`, `@sarah`, `~home`
  count: number
  first: number // createdAt of the oldest entry that has it
  last: number // createdAt of the newest
}

export function computeTagStats(entries: Entry[]): TagStat[] {
  const map = new Map<string, TagStat>()
  for (const e of entries) {
    if (e.deleted) continue
    for (const t of e.tags) {
      const s = map.get(t) ?? { tag: t, count: 0, first: e.createdAt, last: 0 }
      s.count++
      s.first = Math.min(s.first, e.createdAt)
      s.last = Math.max(s.last, e.createdAt)
      map.set(t, s)
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last - a.last)
}

export function countByDay(entries: Entry[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const e of entries) if (!e.deleted) m.set(e.day, (m.get(e.day) ?? 0) + 1)
  return m
}
