import { expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from './entry'
import { PHOTO_MIN_COLUMNS, buildPhotoRows, columnsFor } from './photoRows'

const at = (d: number, h: number, mi = 0) => new Date(2026, 10, d, h, mi).getTime()
const img = (n: number): ImageRef => ({ hash: String(n).padStart(16, '0'), ext: 'jpg', w: 640, h: 480 })
const photoEntry = (id: string, ts: number, n: number): Entry =>
  makeEntry(`note ${id}`, ts, id, Array.from({ length: n }, (_, k) => img(Number(id.replace(/\D/g, '') || 0) * 10 + k)))

it('columnsFor: a phone gets 3 columns, never fewer than 2, even for an unknown width', () => {
  expect(columnsFor(343)).toBe(3) // a 375 px phone
  expect(columnsFor(50)).toBe(PHOTO_MIN_COLUMNS)
  expect(columnsFor(NaN)).toBe(PHOTO_MIN_COLUMNS)
})

it('buildPhotoRows: newest day and entry first, days never share a row, deleted and photo-less entries skipped', () => {
  const entries = [
    photoEntry('e1', at(2, 9), 1), photoEntry('e2', at(3, 10), 1), photoEntry('e3', at(3, 15), 4),
    { ...photoEntry('e8', at(3, 8), 2), deleted: 1 as const }, makeEntry('had a photo', at(3, 9), 'e9', []),
  ]
  const r = buildPhotoRows(entries, 3)
  expect(r.rows.map((x) => (x.kind === 'day' ? `day ${x.day} (${x.count})` : x.tiles.map((t) => `${t.entry.id}:${t.index}`).join(',')))).toEqual([
    'day 2026-11-03 (5)', 'e3:0,e3:1,e3:2', 'e3:3,e2:0', // the count is photos
    'day 2026-11-02 (1)', 'e1:0',
  ])
  expect([r.photos, r.entries]).toEqual([6, 3])
  expect(buildPhotoRows([], 3).rows).toEqual([])
})

it('buildPhotoRows: tile keys are unique even for a photo two entries share, and input order does not matter', () => {
  const a = makeEntry('a', at(10, 8), 'ka', [img(1)])
  const b = makeEntry('b', at(10, 9), 'kb', [img(1)])
  const keys = buildPhotoRows([a, b], 3).rows.flatMap((x) => (x.kind === 'tiles' ? x.tiles.map((t) => t.key) : []))
  expect(new Set(keys).size).toBe(2)
  const entries = [photoEntry('e11', at(11, 8), 2), photoEntry('e12', at(12, 8), 2), photoEntry('e13', at(11, 18), 1)]
  const sig = (es: Entry[]) => JSON.stringify(buildPhotoRows(es, 2).rows.map((x) => (x.kind === 'day' ? x.day : x.tiles.map((t) => t.key))))
  expect(sig(entries)).toBe(sig([...entries].reverse()))
})
