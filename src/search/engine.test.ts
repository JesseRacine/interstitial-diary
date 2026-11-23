import { describe, expect, it } from 'vitest'
import { type Entry, makeEntry } from '../lib/entry'
import { buildIndex, computeTagStats, runSearch } from './engine'
import { parseQuery } from './query'
import { journalEntries } from '../lib/notes'

const NOW = new Date(2026, 10, 8, 12, 0)
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).getTime()

/** Search `es` and return the ids found. */
const search = (es: Entry[], q: string, sort?: 'relevance' | 'newest' | 'oldest') =>
  runSearch(parseQuery(q, NOW), es, buildIndex(es), sort).map((h) => h.entry.id)
/** Each row: a query and the ids it must find (in any order). */
const check = (es: Entry[], rows: [string, string[]][]) => {
  for (const [q, want] of rows) expect(search(es, q).sort(), q).toEqual([...want].sort())
}

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
  filler.push(makeEntry(`Routine log number ${i} #filler${i % 5}`, at(2026, 1, 1, 8) + i * 23 * 3600_000, `f${i}`))
}
// Two entries with photos and one that had its photos removed (empty list).
const photo = (n: number) => ({ hash: `${n}`.padStart(16, '0'), ext: 'jpg', w: 640, h: 480 })
const withPhotos: Entry[] = [
  makeEntry('Sketch of the garden #snaps', at(2026, 11, 4, 16, 0), 'p1', [photo(1)]),
  makeEntry('Whiteboard after the session #project #snaps', at(2026, 11, 5, 17, 0), 'p2', [photo(2), photo(3)]),
  makeEntry('Shot deleted again #project', at(2026, 11, 6, 17, 0), 'p3', []),
]
const entries = [...known, ...withPhotos, ...filler]

describe('runSearch', () => {
  it('words, phrases, tags, dates, times, weekdays and photos', () => {
    check(entries, [
      ['report draft', ['k1', 'k4']], // all words must match
      ['meet', ['k2', 'k6']], // prefix
      ['meetimg', ['k2', 'k6']], // fuzzy on longer words
      ['"email triage"', ['k1']],
      ['#work #tired', ['k1']],
      ['#meeting|#personal', ['k2', 'k3', 'k5']],
      ['#work -#meeting', ['k1', 'k4', 'k6']],
      ['#tired -dog', ['k1']],
      ['#work from:2026-11-01 to:2026-11-07', ['k1', 'k2']],
      ['#work last:7d', ['k1', 'k2', 'k4']],
      ['#tired in:2026-10', ['k5']],
      ['#work time:09-12', ['k1', 'k4', 'k6']],
      ['-#filler0 -#filler1 -#filler2 -#filler3 -#filler4 time:22-06', ['k3']], // across midnight
      ['day:weekend -routine', ['k3', 'k4']],
      ['has:image', ['p1', 'p2']],
      ['has:image whiteboard', ['p2']],
      ['-has:image #project', ['p3']], // an empty photo list counts as none
      ['has:photo in:2026-10', []],
    ])
  })

  it('sorts filter-only results newest first, or oldest first, and returns highlight terms', () => {
    expect(search(entries, '#work')).toEqual(['k4', 'k2', 'k1', 'k6'])
    expect(search(entries, '#work', 'oldest')).toEqual(['k6', 'k1', 'k2', 'k4'])
    const hit = runSearch(parseQuery('meet', NOW), entries, buildIndex(entries)).find((h) => h.entry.id === 'k2')
    expect(hit?.terms).toContain('meeting')
  })

  it('never finds a deleted entry', () => {
    const del = entries.map((e) => (e.id === 'p1' || e.id === 'k1' ? { ...e, deleted: 1 as const } : e))
    check(del, [['has:image', ['p2']], ['#tired', ['k5']]])
  })

  it('people and places, apart from a plain tag of the same name', () => {
    const people = [
      makeEntry('Lunch with @Sarah_Jones at ~Blue_Door #food', at(2026, 11, 2, 12, 0), 'q1'),
      makeEntry('Call with @tom about the plan', at(2026, 11, 3, 15, 0), 'q2'),
      makeEntry('Coffee with @sarah_jones and @tom ~home', at(2026, 11, 4, 9, 0), 'q3'),
      makeEntry('Mentioned sarah in passing, no tag. #sarah', at(2026, 11, 5, 9, 0), 'q4'),
    ]
    check([...people, ...filler], [
      ['@sarah_jones', ['q1', 'q3']],
      ['@sarah_jones @tom', ['q3']],
      ['@sarah_jones|@tom', ['q1', 'q2', 'q3']],
      ['~blue_door', ['q1']],
      ['@tom -~home', ['q2']],
      ['#sarah', ['q4']],
      ['@sarah_jones #food', ['q1']],
    ])
  })

  it('restaurants are their own kind, apart from a place of the same name', () => {
    const es = [
      makeEntry('Dinner at $Blue_Door, then a walk', at(2026, 11, 2, 19, 0), 'r1'),
      makeEntry('Parked near ~blue_door', at(2026, 11, 3, 10, 0), 'r2'),
      makeEntry('Lunch at $green_leaf with @tom, paid $20', at(2026, 11, 4, 12, 0), 'r3'),
    ]
    check([...es, ...filler], [
      ['$blue_door', ['r1']],
      ['~blue_door', ['r2']],
      ['$blue_door|~blue_door', ['r1', 'r2']],
      ['$green_leaf @tom', ['r3']],
      ['-$blue_door $green_leaf|~blue_door', ['r2', 'r3']],
    ])
    const stats = computeTagStats([...es])
    expect(stats.map((s) => s.tag).sort()).toEqual(['$blue_door', '$green_leaf', '@tom', '~blue_door'])
  })

  it('events: the whole title, any case and spacing, all named events, with other filters; has:event', () => {
    const evs: Entry[] = [
      makeEntry('Day one !"Lisbon trip" landed #travel', at(2026, 11, 1, 9), 'v1'),
      makeEntry('Wrapped up !"lisbon   TRIP" with @sam', at(2026, 11, 3, 9), 'v2'),
      makeEntry(`Birthday !"Jack's 40th" (2026-05-12) and again !"Lisbon trip"`, at(2026, 11, 4, 9), 'v3'), // two events, one dated
      makeEntry('Planning the Lisbon trip, nothing marked', at(2026, 11, 5, 9), 'v4'),
      makeEntry('Dinner for !"Lisbon trip dinner"', at(2026, 11, 6, 9), 'v5'), // a longer title that starts the same
      makeEntry('He said "stop!" and "go"', at(2026, 11, 7, 9), 'v6'), // quote marks, not an event
      { ...makeEntry('Deleted !"Lisbon trip"', at(2026, 11, 2, 9), 'v7'), deleted: 1 as const },
    ]
    expect(search(evs, 'EVENT:"lisbon trip"')).toEqual(['v3', 'v2', 'v1']) // newest first
    check(evs, [
      [`event:"Jack's 40th"`, ['v3']],
      ['event:"Lisbon trip dinner"', ['v5']],
      ['event:lisbon', []],
      [`event:"Lisbon trip" event:"Jack's 40th"`, ['v3']],
      ['event:"Lisbon trip" #travel', ['v1']],
      ['event:"Lisbon trip" @sam', ['v2']],
      ['event:"Lisbon trip" from:2026-11-03', ['v3', 'v2']],
      ['has:event', ['v1', 'v2', 'v3', 'v5']],
      ['-has:event', ['v4', 'v6']],
    ])
  })
})

describe('computeTagStats', () => {
  it('counts tags, people and places, most used first, with first and last use, skipping deleted entries', () => {
    const stats = computeTagStats(known)
    expect(stats[0]).toMatchObject({ tag: 'work', count: 4, first: at(2026, 9, 1, 9), last: at(2026, 11, 8, 10, 5) })
    expect(stats.find((s) => s.tag === 'tired')).toMatchObject({ count: 2, first: at(2026, 10, 15, 7, 45), last: at(2026, 11, 2, 9, 14) })
    const e = [
      makeEntry('@tom at ~home', at(2026, 1, 5, 9), 'a'),
      makeEntry('@tom again', at(2026, 1, 9, 9), 'b'),
      { ...makeEntry('@tom deleted', at(2026, 1, 20, 9), 'c'), deleted: 1 as const },
    ]
    expect(computeTagStats(e).find((s) => s.tag === '@tom')).toEqual({ tag: '@tom', count: 2, notes: 0, first: at(2026, 1, 5, 9), last: at(2026, 1, 9, 9) })
  })

  it('counts notes apart: not in count, first or last, but a name only notes have is still listed', () => {
    const e = [
      makeEntry('=@tom Allergic to shellfish', at(2026, 1, 1, 9), 'n1'), // older than his entries: must not move "first"
      makeEntry('Lunch with @tom', at(2026, 1, 5, 9), 'a'),
      makeEntry('=@tom Married to @maria #family', at(2026, 2, 1, 9), 'n2'), // newer: must not move "last"
    ]
    const stats = computeTagStats(e)
    expect(stats.find((s) => s.tag === '@tom')).toEqual({ tag: '@tom', count: 1, notes: 2, first: at(2026, 1, 5, 9), last: at(2026, 1, 5, 9) })
    expect(stats.find((s) => s.tag === '@maria')).toEqual({ tag: '@maria', count: 0, notes: 1, first: 0, last: 0 })
    expect(stats[0].tag).toBe('@tom') // entries first, then notes
  })
})

it('search finds a note by its words and its name, but a page given only the journal entries does not list it', () => {
  const e = [
    makeEntry('Lunch with @tom #food', at(2026, 1, 5, 9), 'a'),
    makeEntry('=@tom Allergic to shellfish #food', at(2026, 1, 6, 9), 'n'),
  ]
  const idx = buildIndex(e)
  expect(runSearch(parseQuery('shellfish'), e, idx).map((h) => h.entry.id)).toEqual(['n'])
  expect(runSearch(parseQuery('@tom'), e, idx, 'newest').map((h) => h.entry.id)).toEqual(['n', 'a'])
  expect(runSearch(parseQuery('@tom'), journalEntries(e), idx).map((h) => h.entry.id)).toEqual(['a'])
})
