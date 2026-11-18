import { expect, it } from 'vitest'
import { type Entry, makeEntry } from './entry'
import { computeEvents } from './events'
import { buildWeekReview, compareLabel, weekStart } from './weekReview'

// November 2026: Sunday the 8th, so Monday the 9th starts the week under test (tests run in UTC).
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
let n = 0
const e = (text: string, d: number, h: number, extra: Partial<Entry> = {}): Entry => ({ ...makeEntry(text, at(d, h), `e${++n}`), ...extra })
const MON = '2026-11-09'

it('a week starts on Monday, across months and years; a Sunday belongs to the week before', () => {
  for (const d of ['2026-11-09', '2026-11-15']) expect(weekStart(d)).toBe(MON)
  expect(weekStart('2026-11-08')).toBe('2026-11-02')
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
  expect(compareLabel(7, 4)).toBe('+3 vs last week')
  expect(compareLabel(3, 3)).toBe('Same as last week')
})

it('counts entries per day, the busiest day and the week before; other weeks and deleted entries are left out', () => {
  const entries = [
    e('a', 9, 9), e('b', 11, 9), e('c', 11, 10), e('f', 15, 22),
    e('prev1', 2, 9), e('prev2', 8, 23), e('older', 1, 9), e('next', 16, 9), e('gone', 10, 10, { deleted: 1 }),
  ]
  const r = buildWeekReview(entries, MON, [])
  expect(r.days.map((d) => d.count)).toEqual([1, 0, 2, 0, 0, 0, 1])
  expect([r.total, r.activeDays, r.previousTotal]).toEqual([4, 3, 2])
  expect(r.busiest).toEqual({ day: '2026-11-11', count: 2 })
  expect(buildWeekReview([], MON, []).busiest).toBeNull()
})

it('lists top tags, people and places, photos, and the events with this week’s entries only', () => {
  const img = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 1, h: 1 }
  const entries = [
    e('standup #work with @sam !"Lisbon trip"', 9, 9, { images: [img, img] }),
    e('more #work at ~office', 10, 9),
    e('#work with @sam and @ana', 11, 9),
    e('old #work @sam !"Lisbon trip"', 6, 9), // the week before
  ]
  const r = buildWeekReview(entries, MON, computeEvents(entries))
  expect(r.top.map((t) => [t.kind.id, t.items])).toEqual([
    ['tag', [{ tag: 'work', count: 3 }]],
    ['person', [{ tag: '@sam', count: 2 }, { tag: '@ana', count: 1 }]],
    ['place', [{ tag: '~office', count: 1 }]],
  ])
  expect(r.photos).toBe(2)
  expect(r.events).toEqual([{ id: expect.any(String), title: 'Lisbon trip', first: '2026-11-06', last: '2026-11-09', count: 1 }])
})
