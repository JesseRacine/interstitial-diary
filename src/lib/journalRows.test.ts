import { expect, it } from 'vitest'
import { makeEntry } from './entry'
import { buildRows, dayAtRow, dayOnOrAfter, rowOfEntry } from './journalRows'

const at = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime()

const entries = [
  makeEntry('third', at(2026, 3, 2, 9, 30), 'c'),
  makeEntry('first', at(2026, 3, 1, 8, 0), 'a'),
  makeEntry('second', at(2026, 3, 1, 9, 15), 'b'),
]

it('buildRows: oldest first, a header with its count per day, gaps within a day only, the last entry of each day marked', () => {
  const { rows, days } = buildRows(entries)
  expect(rows.map((r) => (r.kind === 'day' ? `# ${r.day} (${r.count})` : `${r.entry.text} ${r.gapMinutes} ${r.last}`))).toEqual([
    '# 2026-03-01 (2)', 'first null false', 'second 75 true', '# 2026-03-02 (1)', 'third null true',
  ])
  expect(days).toEqual([
    { day: '2026-03-01', index: 0, count: 2 },
    { day: '2026-03-02', index: 3, count: 1 },
  ])
  expect(buildRows([])).toEqual({ rows: [], days: [] })
})

it('lookups: the row of an entry, the first day on or after a date, the day of a row', () => {
  const { rows, days } = buildRows(entries)
  expect(rowOfEntry(rows, 'b')).toBe(2)
  expect(rowOfEntry(rows, 'nope')).toBe(-1)
  expect(dayOnOrAfter(days, '2026-02-01')?.index).toBe(0)
  expect(dayOnOrAfter(days, '2026-03-02')?.index).toBe(3)
  expect(dayOnOrAfter(days, '2026-03-03')).toBeNull()
  expect(dayAtRow(days, 2)?.day).toBe('2026-03-01')
  expect(dayAtRow(days, 4)?.day).toBe('2026-03-02')
})
