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
// Two entries with photos (k7 has two) and one that had its photos removed (empty list).
const photo = (n: number) => ({ hash: `${n}`.padStart(16, '0'), ext: 'jpg', w: 640, h: 480 })
const withPhotos: Entry[] = [
  makeEntry('Sketch of the garden #snaps', at(2026, 11, 4, 16, 0), 'p1', [photo(1)]),
  makeEntry('Whiteboard after the session #project #snaps', at(2026, 11, 5, 17, 0), 'p2', [photo(2), photo(3)]),
  makeEntry('Shot deleted again #project', at(2026, 11, 6, 17, 0), 'p3', []),
]
const entries = [...known, ...withPhotos, ...filler]
const index = buildIndex(entries)
const ids = (q: string, sort?: 'relevance' | 'newest' | 'oldest') =>
  runSearch(parseQuery(q, NOW), entries, index, sort).map((h) => h.entry.id)

describe('event filters', () => {
  const evs: Entry[] = [
    makeEntry('Day one !"Lisbon trip" landed #travel', at(2026, 11, 1, 9), 'v1'),
    makeEntry('Wrapped up !"lisbon   TRIP" with @sam', at(2026, 11, 3, 9), 'v2'), // same title, other spacing and capitals
    makeEntry(`Birthday !"Jack's 40th" and again !"Lisbon trip"`, at(2026, 11, 4, 9), 'v3'), // names two events
    makeEntry('Planning the Lisbon trip, nothing marked', at(2026, 11, 5, 9), 'v4'), // the words, but no marker
    makeEntry('Dinner for !"Lisbon trip dinner"', at(2026, 11, 6, 9), 'v5'), // a longer title that starts the same
    makeEntry('He said "stop!" and "go"', at(2026, 11, 7, 9), 'v6'), // quote marks, not an event
    { ...makeEntry('Deleted !"Lisbon trip"', at(2026, 11, 2, 9), 'v7'), deleted: 1 as const },
  ]
  const evIndex = buildIndex(evs)
  const evIds = (q: string) => runSearch(parseQuery(q, NOW), evs, evIndex).map((h) => h.entry.id)

  it('event:"title" finds entries that name that event, newest first', () => {
    expect(evIds('event:"Lisbon trip"')).toEqual(['v3', 'v2', 'v1'])
    expect(evIds('EVENT:"lisbon trip"')).toEqual(['v3', 'v2', 'v1'])
    expect(evIds(`event:"Jack's 40th"`)).toEqual(['v3'])
  })
  it('needs the whole title: plain words and longer titles do not match', () => {
    expect(evIds('event:"Lisbon trip"')).not.toContain('v4')
    expect(evIds('event:"Lisbon trip"')).not.toContain('v5')
    expect(evIds('event:"Lisbon trip dinner"')).toEqual(['v5'])
    expect(evIds('event:lisbon')).toEqual([])
  })
  it('several events: the entry must name them all', () => {
    expect(evIds(`event:"Lisbon trip" event:"Jack's 40th"`)).toEqual(['v3'])
    expect(evIds(`event:"Jack's 40th" event:"Lisbon trip dinner"`)).toEqual([])
  })
  it('combines with tags, words and dates', () => {
    expect(evIds('event:"Lisbon trip" #travel')).toEqual(['v1'])
    expect(evIds('event:"Lisbon trip" @sam')).toEqual(['v2'])
    expect(evIds('event:"Lisbon trip" landed')).toEqual(['v1'])
    expect(evIds('event:"Lisbon trip" from:2026-11-03')).toEqual(['v3', 'v2'])
  })
  it('has:event keeps entries that name any event; -has:event the others', () => {
    expect(evIds('has:event').sort()).toEqual(['v1', 'v2', 'v3', 'v5'])
    expect(evIds('-has:event').sort()).toEqual(['v4', 'v6'])
    expect(evIds('has:event #travel')).toEqual(['v1'])
  })
  it('a marker with its own date still matches by title', () => {
    const dated = [makeEntry('Night out !"Jack\'s 40th" (2026-05-12) with @sam', at(2026, 11, 1, 9), 'd1'), makeEntry('Plain', at(2026, 11, 2, 9), 'd2')]
    const run = (q: string) => runSearch(parseQuery(q, NOW), dated, buildIndex(dated)).map((h) => h.entry.id)
    expect(run(`event:"Jack's 40th"`)).toEqual(['d1'])
    expect(run('has:event')).toEqual(['d1'])
  })
  it('a deleted entry is never found', () => {
    expect(evIds('event:"Lisbon trip"')).not.toContain('v7')
    expect(evIds('has:event')).not.toContain('v7')
  })
})

describe('runSearch', () => {
  it('keywords: all must match', () => expect(ids('report draft').sort()).toEqual(['k1', 'k4']))
  it('prefix match', () => expect(ids('meet').sort()).toEqual(['k2', 'k6']))
  it('fuzzy match on longer words', () => expect(ids('meetimg').sort()).toEqual(['k2', 'k6']))
  it('exact phrase', () => expect(ids('"email triage"')).toEqual(['k1']))
  it('tags all', () => expect(ids('#work #tired')).toEqual(['k1']))
  it('tags any', () => expect(ids('#meeting|#personal').sort()).toEqual(['k2', 'k3', 'k5']))
  it('people and places', () => {
    const people = [
      makeEntry('Lunch with @Sarah_Jones at ~Blue_Door #food', at(2026, 11, 2, 12, 0), 'q1'),
      makeEntry('Call with @tom about the plan', at(2026, 11, 3, 15, 0), 'q2'),
      makeEntry('Coffee with @sarah_jones and @tom ~home', at(2026, 11, 4, 9, 0), 'q3'),
      makeEntry('Mentioned sarah in passing, no tag. #sarah', at(2026, 11, 5, 9, 0), 'q4'),
    ]
    const all = [...people, ...filler]
    const run = (q: string) => runSearch(parseQuery(q, NOW), all, buildIndex(all)).map((h) => h.entry.id).sort()
    expect(run('@sarah_jones')).toEqual(['q1', 'q3'])
    expect(run('@sarah_jones @tom')).toEqual(['q3'])
    expect(run('@sarah_jones|@tom')).toEqual(['q1', 'q2', 'q3'])
    expect(run('~blue_door')).toEqual(['q1'])
    expect(run('@tom -~home')).toEqual(['q2'])
    expect(run('#sarah')).toEqual(['q4']) // the plain tag, not the person
    expect(run('@sarah_jones #food')).toEqual(['q1'])
    expect(computeTagStats(people).map((s) => s.tag).sort()).toEqual(['sarah', '@sarah_jones', '@tom', '~blue_door', '~home', 'food'].sort())
  })
  it('exclude tag', () => expect(ids('#work -#meeting').sort()).toEqual(['k1', 'k4', 'k6']))
  it('exclude word', () => expect(ids('#tired -dog')).toEqual(['k1']))
  it('date range', () => expect(ids('#work from:2026-11-01 to:2026-11-07').sort()).toEqual(['k1', 'k2']))
  it('relative date', () => expect(ids('#work last:7d').sort()).toEqual(['k1', 'k2', 'k4']))
  it('month', () => expect(ids('#tired in:2026-10')).toEqual(['k5']))
  it('time window', () => expect(ids('#work time:09-12').sort()).toEqual(['k1', 'k4', 'k6']))
  it('time window across midnight', () => expect(ids('-#filler0 -#filler1 -#filler2 -#filler3 -#filler4 time:22-06')).toEqual(['k3']))
  it('weekday', () => expect(ids('day:weekend -routine').sort()).toEqual(['k3', 'k4']))
  it('has:image keeps only entries with photos', () => expect(ids('has:image').sort()).toEqual(['p1', 'p2']))
  it('has:image combines with other filters', () => {
    expect(ids('has:image #project')).toEqual(['p2'])
    expect(ids('has:image whiteboard')).toEqual(['p2'])
    expect(ids('has:photo in:2026-10')).toEqual([])
  })
  it('-has:image keeps only entries without photos (an empty list counts as none)', () => {
    expect(ids('-has:image #project')).toEqual(['p3'])
    expect(ids('-has:image #snaps')).toEqual([])
  })
  it('a deleted entry with photos is not found', () => {
    const del = entries.map((e) => (e.id === 'p1' ? { ...e, deleted: 1 as const } : e))
    expect(runSearch(parseQuery('has:image', NOW), del, buildIndex(del)).map((h) => h.entry.id)).toEqual(['p2'])
  })
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
  it('records the first and last time each was used', () => {
    const stats = computeTagStats(known)
    // #tired: k1 (2 Nov 2026) and k5 (15 Oct 2026)
    expect(stats.find((s) => s.tag === 'tired')).toMatchObject({ first: at(2026, 10, 15, 7, 45), last: at(2026, 11, 2, 9, 14) })
    // #work: oldest k6 (1 Sep), newest k4 (8 Nov)
    expect(stats.find((s) => s.tag === 'work')).toMatchObject({ first: at(2026, 9, 1, 9), last: at(2026, 11, 8, 10, 5) })
  })
  it('counts people and places like tags, and skips deleted entries', () => {
    const e = [
      makeEntry('@tom at ~home', at(2026, 1, 5, 9), 'a'),
      makeEntry('@tom again', at(2026, 1, 9, 9), 'b'),
      { ...makeEntry('@tom deleted', at(2026, 1, 20, 9), 'c'), deleted: 1 as const },
    ]
    const stats = computeTagStats(e)
    expect(stats.find((s) => s.tag === '@tom')).toEqual({ tag: '@tom', count: 2, first: at(2026, 1, 5, 9), last: at(2026, 1, 9, 9) })
    expect(stats.find((s) => s.tag === '~home')?.count).toBe(1)
  })
})
