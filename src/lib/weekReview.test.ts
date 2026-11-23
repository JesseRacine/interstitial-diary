import { expect, it } from 'vitest'
import { type Entry, makeEntry } from './entry'
import { computeEvents } from './events'
import { buildWeekReview, compareLabel, weekStart } from './weekReview'

// November 2026: Sunday the 8th starts the week under test (Sunday to Saturday; tests run in UTC).
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
let n = 0
const e = (text: string, d: number, h: number, extra: Partial<Entry> = {}): Entry => ({ ...makeEntry(text, at(d, h), `e${++n}`), ...extra })
const SUN = '2026-11-08'

it('a week starts on Sunday, across months and years; a Saturday belongs to the week it ends', () => {
  for (const d of ['2026-11-08', '2026-11-14']) expect(weekStart(d)).toBe(SUN)
  expect(weekStart('2026-11-15')).toBe('2026-11-15')
  expect(weekStart('2027-01-01')).toBe('2026-12-27')
  expect(compareLabel(7, 4)).toBe('+3 vs last week')
  expect(compareLabel(3, 3)).toBe('Same as last week')
})

it('counts entries per day, the busiest day and the week before; other weeks and deleted entries are left out', () => {
  const entries = [
    e('a', 8, 9), e('b', 10, 9), e('c', 10, 10), e('f', 14, 22),
    e('prev1', 1, 9), e('prev2', 7, 23), e('older', 0, 9), e('next', 15, 9), e('gone', 9, 10, { deleted: 1 }),
  ]
  const r = buildWeekReview(entries, SUN, [])
  expect(r.days.map((d) => d.count)).toEqual([1, 0, 2, 0, 0, 0, 1])
  expect([r.total, r.activeDays, r.previousTotal]).toEqual([4, 3, 2])
  expect(r.busiest).toEqual({ day: '2026-11-10', count: 2 })
  expect(buildWeekReview([], SUN, []).busiest).toBeNull()
})

it('lists top tags, people, places and restaurants, photos, and the events with this week’s entries only', () => {
  const img = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 1, h: 1 }
  const entries = [
    e('standup #work with @sam !"Lisbon trip"', 8, 9, { images: [img, img] }),
    e('more #work at ~office, lunch at $nobu paid $20', 9, 9),
    e('#work with @sam and @ana, dinner at $nobu and $blue_door', 10, 9),
    e('old #work @sam !"Lisbon trip"', 5, 9), // the week before
  ]
  const r = buildWeekReview(entries, SUN, computeEvents(entries))
  expect(r.top.map((t) => [t.kind.id, t.items])).toEqual([
    ['tag', [{ tag: 'work', count: 3 }]],
    ['person', [{ tag: '@sam', count: 2 }, { tag: '@ana', count: 1 }]],
    ['place', [{ tag: '~office', count: 1 }]],
    ['restaurant', [{ tag: '$nobu', count: 2 }, { tag: '$blue_door', count: 1 }]],
  ])
  expect(r.photos).toBe(2)
  expect(r.events).toEqual([{ id: expect.any(String), title: 'Lisbon trip', first: '2026-11-05', last: '2026-11-08', count: 1 }])
})
