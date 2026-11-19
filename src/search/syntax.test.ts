import { describe, expect, it } from 'vitest'
import { isEmptyQuery, parseQuery } from './query'
import { searchSyntax, syntaxExamples } from './syntax'

const NOW = new Date(2026, 10, 8, 12, 0)

describe('the search syntax shown in the help and the Manual', () => {
  // Both ways of writing the time of day (the table follows the device's 12- or 24-hour clock).
  for (const twelve of [true, false]) {
    const rows = searchSyntax(twelve)

    it(`every example parses without an error and does something (${twelve ? '12' : '24'}-hour clock)`, () => {
      for (const [row] of rows) {
        for (const example of [row, ...syntaxExamples(row)]) {
          const q = parseQuery(example, NOW)
          expect(q.errors, example).toEqual([])
          expect(isEmptyQuery(q), example).toBe(false)
        }
      }
    })

    it(`has no repeated rows and a description for each (${twelve ? '12' : '24'}-hour clock)`, () => {
      expect(new Set(rows.map(([q]) => q)).size).toBe(rows.length)
      expect(rows.every(([, d]) => d.length > 5)).toBe(true)
    })
  }

  it('the time-of-day row is worded for the clock, and mentions the other way', () => {
    const time = (twelve: boolean) => searchSyntax(twelve).find(([q]) => q.includes('time:'))!
    expect(time(true)[0]).toContain('time:9am-12pm')
    expect(time(true)[1]).toContain('24-hour')
    expect(time(false)[0]).toContain('time:09-12')
    expect(time(false)[1]).toContain('12-hour')
  })
})
