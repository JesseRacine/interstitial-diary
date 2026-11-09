import { describe, expect, it } from 'vitest'
import { makeEntry } from './entry'
import { buildRows, dayAtRow, dayOnOrAfter, rowOfEntry } from './journalRows'

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime()

const entries = [
  makeEntry('third', at(2026, 3, 2, 9, 30), 'c'),
  makeEntry('first', at(2026, 3, 1, 8, 0), 'a'),
  makeEntry('second', at(2026, 3, 1, 9, 15), 'b'),
]

describe('buildRows', () => {
  it('orders oldest first with a header row per day', () => {
    const { rows, days } = buildRows(entries)
    expect(rows.map((r) => (r.kind === 'day' ? `# ${r.day}` : r.entry.text))).toEqual([
      '# 2026-03-01', 'first', 'second', '# 2026-03-02', 'third',
    ])
    expect(days).toEqual([
      { day: '2026-03-01', index: 0, count: 2 },
      { day: '2026-03-02', index: 3, count: 1 },
    ])
  })

  it('puts the entry count on each day header', () => {
    const { rows } = buildRows(entries)
    expect(rows[0]).toMatchObject({ kind: 'day', count: 2 })
    expect(rows[3]).toMatchObject({ kind: 'day', count: 1 })
  })

  it('measures the gap from the previous entry on the same day only', () => {
    const { rows } = buildRows(entries)
    expect(rows[1]).toMatchObject({ gapMinutes: null })
    expect(rows[2]).toMatchObject({ gapMinutes: 75 })
    expect(rows[4]).toMatchObject({ gapMinutes: null })
  })

  it('marks the last entry of each day', () => {
    const { rows } = buildRows(entries)
    expect(rows.flatMap((r) => (r.kind === 'entry' ? [r.last] : []))).toEqual([false, true, true])
  })

  it('does not mutate its input and handles an empty journal', () => {
    const copy = [...entries]
    buildRows(entries)
    expect(entries).toEqual(copy)
    expect(buildRows([])).toEqual({ rows: [], days: [] })
  })

  it('scales to two years of entries', () => {
    const many = Array.from({ length: 7300 }, (_, i) =>
      makeEntry(`e${i}`, at(2025, 1, 1 + Math.floor(i / 10), 8 + (i % 10), 0), `id${String(i).padStart(5, '0')}`))
    const { rows, days } = buildRows(many)
    expect(days).toHaveLength(730)
    expect(rows).toHaveLength(7300 + 730)
  })
})

describe('lookups', () => {
  const { rows, days } = buildRows(entries)
  it('finds the row of an entry', () => {
    expect(rowOfEntry(rows, 'b')).toBe(2)
    expect(rowOfEntry(rows, 'nope')).toBe(-1)
  })
  it('finds the first day on or after a date', () => {
    expect(dayOnOrAfter(days, '2026-03-01')?.index).toBe(0)
    expect(dayOnOrAfter(days, '2026-02-01')?.index).toBe(0)
    expect(dayOnOrAfter(days, '2026-03-02')?.index).toBe(3)
    expect(dayOnOrAfter(days, '2026-03-03')).toBeNull()
  })
  it('finds the day containing a row', () => {
    expect(dayAtRow(days, 2)?.day).toBe('2026-03-01')
    expect(dayAtRow(days, 3)?.day).toBe('2026-03-02')
    expect(dayAtRow(days, 4)?.day).toBe('2026-03-02')
  })
})
