import { describe, expect, it } from 'vitest'
import { clockLabel, hourName, hourRange, searchHour, uses12HourClock } from './clock'
import { longDayLabel, shortDayLabel, timeLabel } from './entry'

const at = (h: number, m: number) => new Date(2026, 10, 19, h, m).getTime()

describe('the clock follows the device setting', () => {
  it('reads 12 or 24 hours from the locale', () => {
    expect(uses12HourClock('en-US')).toBe(true)
    expect(uses12HourClock('en-GB')).toBe(false)
    expect(uses12HourClock('de-DE')).toBe(false)
    expect(typeof uses12HourClock()).toBe('boolean')
  })

  it('words a time for either clock', () => {
    expect([clockLabel(at(17, 31), true), clockLabel(at(17, 31), false)]).toEqual(['5:31 PM', '17:31'])
    expect(clockLabel(at(0, 5), true)).toBe('12:05 AM')
    expect(clockLabel(at(12, 0), true)).toBe('12:00 PM')
    expect(clockLabel(at(9, 7), true)).toBe('9:07 AM')
    expect(clockLabel(at(0, 5), false)).toBe('00:05')
    expect(timeLabel(at(17, 31))).toBe('17:31') // the saved files and the date field keep 24 hours whatever the device says
  })

  it('words the parts of the day for either clock', () => {
    expect([[0, 6], [6, 12], [12, 18], [18, 24]].map(([a, b]) => hourRange(a, b, true))).toEqual(
      ['12 AM–6 AM', '6 AM–12 PM', '12 PM–6 PM', '6 PM–12 AM'])
    expect([[0, 6], [6, 12], [12, 18], [18, 24]].map(([a, b]) => hourRange(a, b, false))).toEqual(['0–6', '6–12', '12–18', '18–24'])
    expect([hourName(24, true), hourName(24, false)]).toEqual(['12 AM', '24'])
  })

  it('writes the quick search times for either clock', () => {
    expect([5, 12, 18, 22, 24].map((h) => searchHour(h, true))).toEqual(['5am', '12pm', '6pm', '10pm', '12am'])
    expect([5, 12, 18, 22, 24].map((h) => searchHour(h, false))).toEqual(['05', '12', '18', '22', '24'])
  })
})

describe('dates are written the US way', () => {
  it('long and short day labels', () => {
    expect(longDayLabel('2026-11-19')).toBe('Thursday, November 19, 2026')
    expect(shortDayLabel('2026-11-19')).toBe('Thu, Nov 19, 2026')
    expect(shortDayLabel('2027-01-02')).toBe('Sat, Jan 2, 2027')
  })
})
