import { describe, expect, it } from 'vitest'
import { eventDateLabel, eventYears, filterEvents, groupEvents, sortEvents } from './eventRows'
import type { EventStat } from './events'

const ev = (id: string, title: string, first: string, last = first, count = 1): EventStat => ({
  id, key: title.toLowerCase(), title, count, first, last, entryIds: [id],
})

const events = [
  ev('a', "Sam's birthday", '2025-03-02'),
  ev('b', 'Beach weekend', '2026-02-06', '2026-02-08', 3),
  ev('c', "Jack's 40th", '2026-02-20'),
  ev('d', 'Conference', '2026-11-30', '2026-12-02', 2),
]

describe('event date labels', () => {
  it('writes one day, a range in a month, across months and across years', () => {
    expect(eventDateLabel('2026-11-13', '2026-11-13')).toBe('13 Nov 2026')
    expect(eventDateLabel('2026-11-08', '2026-11-10')).toBe('8–10 Nov 2026')
    expect(eventDateLabel('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Dec 2026')
    expect(eventDateLabel('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027')
  })
})

describe('filtering and sorting events', () => {
  it('lists the years that have events, newest first', () => {
    expect(eventYears(events)).toEqual(['2026', '2025'])
    expect(eventYears([])).toEqual([])
  })
  it('filters by title text (any case) and by year', () => {
    expect(filterEvents(events, 'BEACH', null).map((e) => e.id)).toEqual(['b'])
    expect(filterEvents(events, "'s", null).map((e) => e.id)).toEqual(['a', 'c'])
    expect(filterEvents(events, '', '2025').map((e) => e.id)).toEqual(['a'])
    expect(filterEvents(events, 'c', '2026').map((e) => e.id)).toEqual(['b', 'c', 'd'])
    expect(filterEvents(events, 'nothing', null)).toEqual([])
  })
  it('sorts newest first, oldest first or by title, without changing the input', () => {
    const copy = [...events]
    expect(sortEvents(events, 'newest').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a'])
    expect(sortEvents(events, 'oldest').map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sortEvents(events, 'name').map((e) => e.id)).toEqual(['b', 'd', 'c', 'a'])
    expect(events).toEqual(copy)
  })
  it('puts two events of the same title in date order when sorted by title', () => {
    const l = [ev('y', 'Trip', '2026-05-01'), ev('x', 'Trip', '2025-05-01')]
    expect(sortEvents(l, 'name').map((e) => e.id)).toEqual(['x', 'y'])
  })
})

describe('grouping events', () => {
  it('groups by the month an event started, in the order of the list', () => {
    const g = groupEvents(sortEvents(events, 'newest'), 'newest')
    expect(g.map((x) => [x.key, x.label, x.events.map((e) => e.id)])).toEqual([
      ['2026-11', 'November 2026', ['d']],
      ['2026-02', 'February 2026', ['c', 'b']],
      ['2025-03', 'March 2025', ['a']],
    ])
  })
  it('keeps an A–Z list as one group, and an empty list as none', () => {
    expect(groupEvents(sortEvents(events, 'name'), 'name')).toHaveLength(1)
    expect(groupEvents([], 'name')).toEqual([])
    expect(groupEvents([], 'newest')).toEqual([])
  })
})
