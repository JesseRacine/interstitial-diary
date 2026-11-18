import { expect, it } from 'vitest'
import { eventDateLabel, eventGap, eventYears, filterEvents, groupEvents, mergeTargets, sortEvents } from './eventRows'
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

it('date labels: one day, a range in a month, across months and across years', () => {
  expect(eventDateLabel('2026-11-13', '2026-11-13')).toBe('13 Nov 2026')
  expect(eventDateLabel('2026-11-08', '2026-11-10')).toBe('8–10 Nov 2026')
  expect(eventDateLabel('2026-11-30', '2026-12-02')).toBe('30 Nov – 2 Dec 2026')
  expect(eventDateLabel('2026-12-30', '2027-01-02')).toBe('30 Dec 2026 – 2 Jan 2027')
})

it('merge targets: every other title, nearest in time first, never the event itself or its own title', () => {
  const lisbon = ev('l1', 'Lisbon trip', '2026-11-08', '2026-11-10', 3)
  const near = ev('l2', 'Lisbon tripp', '2026-11-11') // a misspelling, the day after
  const far = ev('l3', 'Lisbon holiday', '2026-06-01')
  const sameTitleLater = { ...ev('l4', 'Lisbon trip', '2027-05-01'), key: lisbon.key }
  const sameDay = ev('l5', 'Aardvark', '2026-11-09') // overlaps the event itself
  expect(eventGap(lisbon, near)).toBe(1)
  expect(eventGap(lisbon, sameDay)).toBe(0)
  expect(eventGap(lisbon, far)).toBe(160)
  expect(mergeTargets([far, lisbon, near, sameDay, sameTitleLater], lisbon).map((e) => e.id)).toEqual(['l5', 'l2', 'l3'])
  expect(mergeTargets([], lisbon)).toEqual([])
})

it('the Events list: years, filter by text and year, sort, and group by month', () => {
  expect(eventYears(events)).toEqual(['2026', '2025'])
  expect(filterEvents(events, 'BEACH', null).map((e) => e.id)).toEqual(['b'])
  expect(filterEvents(events, 'c', '2026').map((e) => e.id)).toEqual(['b', 'c', 'd'])
  expect(sortEvents(events, 'newest').map((e) => e.id)).toEqual(['d', 'c', 'b', 'a'])
  expect(sortEvents(events, 'name').map((e) => e.id)).toEqual(['b', 'd', 'c', 'a'])
  const g = groupEvents(sortEvents(events, 'newest'), 'newest')
  expect(g.map((x) => [x.label, x.events.map((e) => e.id)])).toEqual([
    ['November 2026', ['d']], ['February 2026', ['c', 'b']], ['March 2025', ['a']],
  ])
  expect(groupEvents(sortEvents(events, 'name'), 'name')).toHaveLength(1)
})
