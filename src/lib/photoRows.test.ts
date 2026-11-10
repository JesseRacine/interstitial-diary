import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from './entry'
import { PHOTO_GAP, PHOTO_MIN_COLUMNS, PHOTO_MIN_TILE, buildPhotoRows, columnsFor } from './photoRows'

const at = (d: number, h: number, mi = 0) => new Date(2026, 10, d, h, mi).getTime()
const img = (n: number): ImageRef => ({ hash: String(n).padStart(16, '0'), ext: 'jpg', w: 640, h: 480 })
const photoEntry = (id: string, ts: number, n: number): Entry =>
  makeEntry(`note ${id}`, ts, id, Array.from({ length: n }, (_, k) => img(Number(id.replace(/\D/g, '') || 0) * 10 + k)))

describe('columnsFor', () => {
  it('fits as many minimum-size tiles as the width allows', () => {
    const w = (n: number) => n * PHOTO_MIN_TILE + (n - 1) * PHOTO_GAP
    expect(columnsFor(w(3))).toBe(3)
    expect(columnsFor(w(3) - 1)).toBe(2)
    expect(columnsFor(w(6))).toBe(6)
  })
  it('never goes below two columns, and copes with an unknown width', () => {
    expect(columnsFor(50)).toBe(PHOTO_MIN_COLUMNS)
    expect(columnsFor(0)).toBe(PHOTO_MIN_COLUMNS)
    expect(columnsFor(NaN)).toBe(PHOTO_MIN_COLUMNS)
  })
  it('a 375 px phone (343 px of grid) gets 3 columns', () => expect(columnsFor(343)).toBe(3))
})

describe('buildPhotoRows', () => {
  it('has no rows without photos', () => {
    const r = buildPhotoRows([makeEntry('plain', at(1, 9), 'a')], 3)
    expect(r).toEqual({ rows: [], photos: 0, entries: 0 })
    expect(buildPhotoRows([], 3).rows).toEqual([])
  })

  it('groups by day, newest day first, newest entry first within a day', () => {
    const entries = [photoEntry('e1', at(2, 9), 1), photoEntry('e2', at(3, 10), 1), photoEntry('e3', at(3, 15), 1)]
    const r = buildPhotoRows(entries, 3)
    expect(r.rows.map((x) => (x.kind === 'day' ? `day ${x.day} (${x.count})` : x.tiles.map((t) => t.entry.id).join(',')))).toEqual([
      'day 2026-11-03 (2)', 'e3,e2',
      'day 2026-11-02 (1)', 'e1',
    ])
    expect([r.photos, r.entries]).toEqual([3, 3])
  })

  it("keeps an entry's photos in their own order, each tile pointing at its position", () => {
    const e = photoEntry('e4', at(5, 8), 3)
    const [, row] = buildPhotoRows([e], 5).rows
    expect(row.kind === 'tiles' && row.tiles.map((t) => t.index)).toEqual([0, 1, 2])
    expect(row.kind === 'tiles' && row.tiles.map((t) => t.image.hash)).toEqual(e.images!.map((i) => i.hash))
  })

  it('splits a day into rows of `columns` tiles; the last row may be short', () => {
    const r = buildPhotoRows([photoEntry('e5', at(6, 8), 7)], 3)
    expect(r.rows.map((x) => (x.kind === 'tiles' ? x.tiles.length : 'day'))).toEqual(['day', 3, 3, 1])
  })

  it("never mixes days in a row", () => {
    const r = buildPhotoRows([photoEntry('e6', at(7, 8), 1), photoEntry('e7', at(8, 8), 1)], 5)
    expect(r.rows.filter((x) => x.kind === 'tiles').map((x) => x.kind === 'tiles' && x.tiles.length)).toEqual([1, 1])
  })

  it('skips deleted entries and entries whose photos were all removed', () => {
    const gone = { ...photoEntry('e8', at(9, 8), 2), deleted: 1 as const }
    const stripped = makeEntry('had a photo', at(9, 9), 'e9', [])
    const keep = photoEntry('e10', at(9, 10), 1)
    const r = buildPhotoRows([gone, stripped, keep], 3)
    expect([r.photos, r.entries]).toEqual([1, 1])
    expect(r.rows).toHaveLength(2)
  })

  it('tile keys are unique, even when the same photo is used by two entries', () => {
    const a = makeEntry('a', at(10, 8), 'ka', [img(1)])
    const b = makeEntry('b', at(10, 9), 'kb', [img(1)])
    const keys = buildPhotoRows([a, b], 3).rows.flatMap((x) => (x.kind === 'tiles' ? x.tiles.map((t) => t.key) : []))
    expect(new Set(keys).size).toBe(2)
  })

  it('the order of the input does not matter', () => {
    const entries = [photoEntry('e11', at(11, 8), 2), photoEntry('e12', at(12, 8), 2), photoEntry('e13', at(11, 18), 1)]
    const sig = (es: Entry[]) => JSON.stringify(buildPhotoRows(es, 2).rows.map((x) => (x.kind === 'day' ? x.day : x.tiles.map((t) => t.key))))
    expect(sig(entries)).toBe(sig([...entries].reverse()))
  })

  it('treats a nonsense column count as one', () => {
    const r = buildPhotoRows([photoEntry('e14', at(13, 8), 3)], 0)
    expect(r.rows.filter((x) => x.kind === 'tiles')).toHaveLength(3)
  })
})
