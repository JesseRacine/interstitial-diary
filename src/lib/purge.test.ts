import { describe, expect, it } from 'vitest'
import { type Entry, makeEntry } from './entry'
import { merge } from './merge'
import { parsePurged, purgedIds, restorable, scrubEntry } from './purge'

const IMG = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
const deleted = (id: string, text: string, createdAt: number): Entry => ({ ...makeEntry(text, createdAt, id), deleted: 1 })

describe('scrubEntry', () => {
  it('erases text, tags and photos but keeps the id, the times and the deletion', () => {
    const e = { ...makeEntry('call @sam #private', 1_000, 'x', [IMG]), deleted: 1 as const, updatedAt: 5_000, prevDay: '2026-01-01' }
    const s = scrubEntry(e)
    expect(s).toMatchObject({ id: 'x', createdAt: 1_000, updatedAt: 5_000, text: '', tags: [], deleted: 1, purged: 1 })
    expect('images' in s).toBe(false)
    expect('prevDay' in s).toBe(false)
  })
})

describe('restorable', () => {
  it('lists deleted, not yet erased entries, newest first', () => {
    const list = restorable([
      makeEntry('live', 1, 'a'),
      deleted('b', 'older', 10),
      deleted('c', 'newer', 20),
      scrubEntry(deleted('d', 'erased', 30)),
    ])
    expect(list.map((e) => e.id)).toEqual(['c', 'b'])
  })
})

describe('purged ids', () => {
  it('purgedIds unions the remote list with this device’s erased entries, sorted', () => {
    const local = [scrubEntry(deleted('m', 'x', 1)), deleted('z', 'not erased', 2), makeEntry('live', 3, 'l')]
    expect(purgedIds(local, ['k', 'm'])).toEqual(['k', 'm'])
    expect(purgedIds([], [])).toEqual([])
  })

  it('parsePurged accepts a list of strings and treats anything else as empty', () => {
    expect(parsePurged('["a","b"]')).toEqual(['a', 'b'])
    expect(parsePurged('["a", 3, null]')).toEqual(['a'])
    expect(parsePurged('{"a":1}')).toEqual([])
    expect(parsePurged('not json')).toEqual([])
    expect(parsePurged(null)).toEqual([])
  })
})

describe('merge with purged ids', () => {
  it('scrubs a live version of a purged id, wherever it came from, and keeps a tombstone for it', () => {
    const remoteLive = { ...makeEntry('secret', 1_000, 'x'), updatedAt: 9_000 }
    const r = merge([], [remoteLive], {}, new Set(['x']))
    expect(r.entries).toHaveLength(1)
    expect(r.entries[0]).toMatchObject({ id: 'x', text: '', deleted: 1, purged: 1 })
    expect(r.tombstones).toEqual({ x: 9_000 })
  })

  it('leaves other entries alone, and an id nobody has produces no row', () => {
    const r = merge([makeEntry('keep', 1, 'k')], [], {}, new Set(['gone']))
    expect(r.entries.map((e) => e.text)).toEqual(['keep'])
  })
})
