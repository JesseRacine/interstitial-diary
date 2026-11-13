import { describe, expect, it } from 'vitest'
import { type Entry, makeEntry } from './entry'
import { computeEvents } from './events'
import { buildWeekReview, compareLabel, weekStart } from './weekReview'

// November 2026: Sunday the 8th, so Monday the 9th starts the week under test (tests run in UTC).
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
let n = 0
const e = (text: string, d: number, h: number, extra: Partial<Entry> = {}): Entry => ({ ...makeEntry(text, at(d, h), `e${++n}`), ...extra })
const MON = '2026-11-09'

describe('weekStart', () => {
  it('is the Monday of the week, for any day in it', () => {
    for (const d of ['2026-11-09', '2026-11-11', '2026-11-15']) expect(weekStart(d)).toBe(MON)
    expect(weekStart('2026-11-16')).toBe('2026-11-16')
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // a Sunday belongs to the week before it
  })

  it('crosses a month and a year', () => {
    expect(weekStart('2026-12-02')).toBe('2026-11-30')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })
})

describe('compareLabel', () => {
  it('says how the week compares with the one before', () => {
    expect(compareLabel(7, 4)).toBe('+3 vs last week')
    expect(compareLabel(2, 4)).toBe('−2 vs last week')
    expect(compareLabel(3, 3)).toBe('Same as last week')
    expect(compareLabel(3, 0)).toBe('+3 vs last week')
    expect(compareLabel(0, 0)).toBe('')
  })
})

describe('buildWeekReview', () => {
  it('an empty week is all zeros', () => {
    const r = buildWeekReview([], MON, [])
    expect(r.end).toBe('2026-11-15')
    expect(r.days.map((d) => d.day)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect([r.total, r.activeDays, r.previousTotal, r.photos, r.busiest]).toEqual([0, 0, 0, 0, null])
    expect(r.top).toEqual([])
    expect(r.events).toEqual([])
    expect(r.bands.every((b) => b.count === 0)).toBe(true)
  })

  it('counts entries per day, active days and the busiest day (the earliest when tied)', () => {
    const entries = [e('a', 9, 9), e('b', 11, 9), e('c', 11, 10), e('d', 13, 9), e('e', 13, 10), e('f', 15, 22)]
    const r = buildWeekReview(entries, MON, [])
    expect(r.days.map((d) => d.count)).toEqual([1, 0, 2, 0, 2, 0, 1])
    expect([r.total, r.activeDays]).toEqual([6, 4])
    expect(r.busiest).toEqual({ day: '2026-11-11', count: 2 })
  })

  it('counts the previous week for comparison, and ignores other weeks and deleted entries', () => {
    const entries = [
      e('this', 10, 9),
      e('prev1', 2, 9), e('prev2', 8, 23), // the Monday and the Sunday of the week before
      e('older', 1, 9), // Sunday 1 Nov: two weeks back
      e('next', 16, 9),
      e('gone', 10, 10, { deleted: 1 }),
    ]
    const r = buildWeekReview(entries, MON, [])
    expect([r.total, r.previousTotal]).toEqual([1, 2])
  })

  it('sorts the week into parts of the day by the hour written', () => {
    const entries = [e('a', 9, 0), e('b', 9, 5), e('c', 9, 6), e('d', 9, 11), e('e', 9, 12), e('f', 9, 17), e('g', 9, 18), e('h', 9, 23)]
    const r = buildWeekReview(entries, MON, [])
    expect(r.bands.map((b) => [b.id, b.count])).toEqual([['night', 2], ['morning', 2], ['afternoon', 2], ['evening', 2]])
  })

  it('lists the most used tags, people and places separately, each kind only if it has any', () => {
    const entries = [
      e('standup #work with @sam', 9, 9),
      e('more #work at ~office', 10, 9),
      e('#work again with @sam and @ana', 11, 9),
      e('#home', 11, 10),
      e('old #work @sam', 3, 9), // last week: not counted
    ]
    const r = buildWeekReview(entries, MON, [])
    expect(r.top.map((t) => [t.kind.id, t.items])).toEqual([
      ['tag', [{ tag: 'work', count: 3 }, { tag: 'home', count: 1 }]],
      ['person', [{ tag: '@sam', count: 2 }, { tag: '@ana', count: 1 }]],
      ['place', [{ tag: '~office', count: 1 }]],
    ])
    expect(buildWeekReview(entries, MON, [], 1).top[0].items).toEqual([{ tag: 'work', count: 3 }])
    expect(buildWeekReview([e('no tags', 9, 9)], MON, []).top).toEqual([])
  })

  it('counts photos', () => {
    const img = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 1, h: 1 }
    const entries = [e('two', 9, 9, { images: [img, img] }), e('one', 10, 9, { images: [img] }), e('none', 11, 9)]
    expect(buildWeekReview(entries, MON, []).photos).toBe(3)
  })

  it('lists events that have an entry this week, with this week’s entries only', () => {
    const entries = [
      e('trip start !"Lisbon trip"', 6, 9), // the week before
      e('day 2 !"Lisbon trip"', 9, 9),
      e('day 3 !"Lisbon trip"', 10, 9),
      e('party !"Jack\'s 40th"', 14, 20),
      e('unrelated', 11, 9),
      e('!"Next week thing"', 17, 9),
    ]
    const r = buildWeekReview(entries, MON, computeEvents(entries))
    expect(r.events).toEqual([
      { id: expect.any(String), title: 'Lisbon trip', first: '2026-11-06', last: '2026-11-10', count: 2 },
      { id: expect.any(String), title: "Jack's 40th", first: '2026-11-14', last: '2026-11-14', count: 1 },
    ])
  })
})
