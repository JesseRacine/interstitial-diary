import { describe, expect, it } from 'vitest'
import { makeEntry } from './entry'
import { fromDateTimeInput, isAllowedTime, retimeEntry, retimedCreatedAt, toDateTimeInput } from './retime'

const at = (d: number, h: number, m = 0, s = 0, ms = 0) => new Date(2026, 10, d, h, m, s, ms).getTime()

describe('retimedCreatedAt', () => {
  it('uses the picked minute and keeps the entry’s own seconds', () => {
    expect(retimedCreatedAt(at(8, 14, 30, 45, 123), at(9, 8, 5))).toBe(at(9, 8, 5, 45, 123))
  })

  it('changes nothing when the picked minute is the one it already has', () => {
    const now = at(8, 14, 30, 45, 123)
    expect(retimedCreatedAt(now, at(8, 14, 30))).toBe(now)
  })
})

describe('date-time field values', () => {
  it('round-trips to the minute in local time', () => {
    const ts = at(8, 9, 14, 45, 123)
    expect(toDateTimeInput(ts)).toBe('2026-11-08T09:14')
    expect(fromDateTimeInput('2026-11-08T09:14')).toBe(at(8, 9, 14))
  })

  it('an empty field is not a time', () => {
    expect(fromDateTimeInput('')).toBeNaN()
  })
})

describe('isAllowedTime', () => {
  it('allows the past and now, not the future or a non-time', () => {
    const now = at(8, 12)
    expect(isAllowedTime(at(1, 9), now)).toBe(true)
    expect(isAllowedTime(now, now)).toBe(true)
    expect(isAllowedTime(now + 1, now)).toBe(false)
    expect(isAllowedTime(Number.NaN, now)).toBe(false)
  })
})

describe('retimeEntry', () => {
  it('recalculates the derived fields, stamps the edit and marks it for sync', () => {
    const e = { ...makeEntry('hi #a', at(8, 14, 30), 'x'), dirty: 0 as const }
    const r = retimeEntry(e, at(7, 23, 5), 5000)
    expect([r.day, r.hour, r.minute, r.updatedAt, r.dirty]).toEqual(['2026-11-07', 23, 23 * 60 + 5, 5000, 1])
    expect(r.tags).toEqual(['a'])
  })

  it('remembers the old day only when the day changes, and keeps the first one through more moves', () => {
    const e = makeEntry('hi', at(8, 14, 30), 'x')
    expect('prevDay' in retimeEntry(e, at(8, 9, 0), 2)).toBe(false)
    const moved = retimeEntry(e, at(7, 9, 0), 2)
    expect(moved.prevDay).toBe('2026-11-08')
    expect(retimeEntry(moved, at(6, 9, 0), 3).prevDay).toBe('2026-11-08')
  })
})
