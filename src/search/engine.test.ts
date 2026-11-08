import { describe, expect, it } from 'vitest'
import { type Entry, makeEntry } from '../lib/entry'
import { buildIndex, computeTagStats, runSearch } from './engine'
import { parseQuery } from './query'

const NOW = new Date(2026, 10, 8, 12, 0)
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

// A few hand-written entries with known properties...
const known: Entry[] = [
  makeEntry('Finished email triage. Feeling scattered. Next: draft the report #work #tired', at(2026, 11, 2, 9, 14), 'k1'),
  makeEntry('Weekly meeting ran long. #work #meeting', at(2026, 11, 3, 14, 0), 'k2'),
  makeEntry('Late night reading, calm. #personal', at(2026, 11, 7, 23, 30), 'k3'), // Saturday
  makeEntry('Report draft done, sent for review #work', at(2026, 11, 8, 10, 5), 'k4'), // Sunday
  makeEntry('Walked the dog, tired but happy #personal #tired', at(2026, 10, 15, 7, 45), 'k5'),
  makeEntry('Stand up meeting, quick one #work', at(2026, 9, 1, 9, 0), 'k6'),
]

// ...plus a few hundred filler entries spread over months, none containing the test words.
const filler: Entry[] = []
for (let i = 0; i < 300; i++) {
  const ts = at(2026, 1, 1, 8) + i * 23 * 3600_000 // every 23 hours from 1 Jan
  filler.push(makeEntry(`Routine log number ${i} #filler${i % 5}`, ts, `f${i}`))
}
const entries = [...known, ...filler]
const index = buildIndex(entries)
const ids = (q: string, sort?: 'relevance' | 'newest' | 'oldest') =>
  runSearch(parseQuery(q, NOW), entries, index, sort).map((h) => h.entry.id)

describe('runSearch', () => {
  it('keywords: all must match', () => expect(ids('report draft').sort()).toEqual(['k1', 'k4']))
  it('prefix match', () => expect(ids('meet').sort()).toEqual(['k2', 'k6']))
  it('fuzzy match on longer words', () => expect(ids('meetimg').sort()).toEqual(['k2', 'k6']))
  it('exact phrase', () => expect(ids('"email triage"')).toEqual(['k1']))
  it('tags all', () => expect(ids('#work #tired')).toEqual(['k1']))
  it('tags any', () => expect(ids('#meeting|#personal').sort()).toEqual(['k2', 'k3', 'k5']))
  it('exclude tag', () => expect(ids('#work -#meeting').sort()).toEqual(['k1', 'k4', 'k6']))
  it('exclude word', () => expect(ids('#tired -dog')).toEqual(['k1']))
  it('date range', () => expect(ids('#work from:2026-11-01 to:2026-11-07').sort()).toEqual(['k1', 'k2']))
  it('relative date', () => expect(ids('#work last:7d').sort()).toEqual(['k1', 'k2', 'k4']))
  it('month', () => expect(ids('#tired in:2026-10')).toEqual(['k5']))
  it('time window', () => expect(ids('#work time:09-12').sort()).toEqual(['k1', 'k4', 'k6']))
  it('time window across midnight', () => expect(ids('-#filler0 -#filler1 -#filler2 -#filler3 -#filler4 time:22-06')).toEqual(['k3']))
  it('weekday', () => expect(ids('day:weekend -routine').sort()).toEqual(['k3', 'k4']))
  it('filters only: sorted newest first', () => expect(ids('#work')).toEqual(['k4', 'k2', 'k1', 'k6']))
  it('oldest first', () => expect(ids('#work', 'oldest')).toEqual(['k6', 'k1', 'k2', 'k4']))
  it('returns highlight terms', () => {
    const [hit] = runSearch(parseQuery('meet', NOW), entries, index).filter((h) => h.entry.id === 'k2')
    expect(hit.terms).toContain('meeting')
  })
  it('ignores deleted entries', () => {
    const del = [{ ...known[0], deleted: 1 as const }, ...known.slice(1)]
    expect(runSearch(parseQuery('#tired', NOW), del, buildIndex(del)).map((h) => h.entry.id)).toEqual(['k5'])
  })
  it('scales to the filler set', () => expect(ids('routine').length).toBe(300))
})

describe('computeTagStats', () => {
  it('counts tags, most used first', () => {
    const stats = computeTagStats(known)
    expect(stats[0]).toMatchObject({ tag: 'work', count: 4 })
    expect(stats.find((s) => s.tag === 'tired')?.count).toBe(2)
  })
})
