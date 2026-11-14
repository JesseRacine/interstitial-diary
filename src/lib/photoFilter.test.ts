import { describe, expect, it } from 'vitest'
import { buildIndex } from '../search/engine'
import { type Entry, type ImageRef, makeEntry } from './entry'
import { filterPhotoEntries, photoCount, photoEntries, photoTopTags, photoYears, setYearOfQuery, yearOfQuery } from './photoFilter'

const NOW = new Date(2026, 10, 8, 12, 0) // Sun 8 Nov 2026
const at = (y: number, mo: number, d: number, h = 9) => new Date(y, mo - 1, d, h).getTime()
const img = (n: number): ImageRef => ({ hash: String(n).padStart(16, '0'), ext: 'jpg', w: 640, h: 480 })

const entries: Entry[] = [
  makeEntry('Lisbon harbour #trip @sam !"Lisbon trip"', at(2026, 6, 10), 'a', [img(1), img(2)]),
  makeEntry('Tram ride #trip ~lisbon', at(2026, 6, 11), 'b', [img(3)]),
  makeEntry('Sketch of the garden #home', at(2025, 5, 2), 'c', [img(4)]),
  makeEntry('Workshop whiteboard #work @sam', at(2026, 10, 30), 'd', [img(5), img(6), img(7)]),
  makeEntry('No photo here #trip', at(2026, 6, 12), 'e'),
  makeEntry('Photo removed again #trip', at(2026, 6, 13), 'f', []),
  { ...makeEntry('Deleted photo #trip', at(2026, 6, 14), 'g', [img(8)]), deleted: 1 as const },
]
const index = buildIndex(entries)
const ids = (q: string) => filterPhotoEntries(q, entries, index, NOW).entries.map((e) => e.id)

describe('photoEntries and photoCount', () => {
  it('keeps live entries that have photos, and counts their photos', () => {
    expect(photoEntries(entries).map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(photoCount(entries)).toBe(2 + 1 + 1 + 3)
    expect(photoCount([])).toBe(0)
  })
})

describe('filterPhotoEntries', () => {
  it('an empty query shows every entry with photos, unfiltered', () => {
    const r = filterPhotoEntries('', entries, index, NOW)
    expect(r.entries.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(r.filtered).toBe(false)
    expect(filterPhotoEntries('   ', entries, index, NOW).filtered).toBe(false)
  })
  it('tags, people and places narrow it, and entries without photos never appear', () => {
    expect(ids('#trip').sort()).toEqual(['a', 'b'])
    expect(ids('@sam').sort()).toEqual(['a', 'd'])
    expect(ids('~lisbon')).toEqual(['b'])
    expect(ids('#trip @sam')).toEqual(['a'])
  })
  it('dates, words and events work like in search, newest first', () => {
    expect(ids('in:2026')).toEqual(['d', 'b', 'a'])
    expect(ids('from:2026-06 to:2026-06')).toEqual(['b', 'a'])
    expect(ids('last:30d')).toEqual(['d'])
    expect(ids('whiteboard')).toEqual(['d'])
    expect(ids('event:"Lisbon trip"')).toEqual(['a'])
    expect(ids('has:event')).toEqual(['a'])
  })
  it('matches nothing when nothing fits, and says it is filtered', () => {
    const r = filterPhotoEntries('#nothing', entries, index, NOW)
    expect(r.entries).toEqual([])
    expect(r.filtered).toBe(true)
  })
  it('-has:image cannot empty the tab: only entries with photos are ever shown', () => {
    expect(ids('-has:image #trip').sort()).toEqual(['a', 'b'])
    expect(ids('has:image #home')).toEqual(['c'])
  })
  it('passes on what the parser did not understand', () => {
    expect(filterPhotoEntries('on:tomorrow #trip', entries, index, NOW).errors).toHaveLength(1)
    expect(filterPhotoEntries('#trip', entries, index, NOW).errors).toEqual([])
  })
  it('a deleted entry is not shown', () => {
    expect(ids('#trip')).not.toContain('g')
  })
})

describe('quick chips and years', () => {
  it('lists the most used tags, people and places among entries with photos only', () => {
    const tags = photoTopTags(entries).map((t) => [t.tag, t.count])
    expect(tags).toEqual(expect.arrayContaining([['trip', 2], ['@sam', 2], ['home', 1], ['work', 1], ['~lisbon', 1]]))
    expect(tags.find(([t]) => t === 'trip')![1]).toBe(2) // the three photo-less #trip entries are not counted
    expect(photoTopTags(entries, 2)).toHaveLength(2)
  })
  it('lists the years that have photos, newest first', () => {
    expect(photoYears(entries)).toEqual(['2026', '2025'])
    expect(photoYears([])).toEqual([])
  })
})

describe('the year in a query', () => {
  it('reads and sets only the in:YYYY token, keeping the rest', () => {
    expect(yearOfQuery('#trip in:2026 @sam')).toBe('2026')
    expect(yearOfQuery('#trip')).toBe('')
    expect(yearOfQuery('in:2026-06')).toBe('') // a month is not a year choice
    expect(setYearOfQuery('#trip @sam', '2025')).toBe('#trip @sam in:2025')
    expect(setYearOfQuery('#trip in:2026 @sam', '2025')).toBe('#trip @sam in:2025')
    expect(setYearOfQuery('#trip IN:2026', '')).toBe('#trip')
    expect(setYearOfQuery('', '2026')).toBe('in:2026')
    expect(setYearOfQuery('event:"Lisbon trip" in:2026', '')).toBe('event:"Lisbon trip"')
  })
})
