import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type ImageRef, entryImages, makeEntry, withDerived } from './entry'

const IMG_A: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
const IMG_B: ImageRef = { hash: '9c01aa22f3b6d710', ext: 'png', w: 800, h: 600 }

let m: typeof import('./db')

beforeAll(async () => {
  // A database written by the previous app version (schema v1, no images), so the upgrade path is exercised.
  const old = new Dexie('interstitial-diary')
  old.version(1).stores({ entries: 'id, createdAt, day, *tags, dirty', meta: 'key' })
  await old.table('entries').add(makeEntry('written before images existed #old', Date.UTC(2026, 0, 1, 9), 'legacy'))
  old.close()
  m = await import('./db')
})

describe('withDerived', () => {
  it('carries images', () => {
    const e = makeEntry('hi', Date.UTC(2026, 0, 1), 'x', [IMG_A, IMG_B])
    expect(withDerived({ ...e, text: 'changed' }).images).toEqual([IMG_A, IMG_B])
  })

  it('leaves the field out when there are no images, so old entries are unchanged', () => {
    expect('images' in makeEntry('hi', 0, 'x')).toBe(false)
    expect('images' in withDerived({ ...makeEntry('hi', 0, 'x'), images: [] })).toBe(false)
  })

  it('copies the refs instead of sharing them', () => {
    const refs = [{ ...IMG_A }]
    const e = makeEntry('hi', 0, 'x', refs)
    refs[0].w = 1
    expect(e.images![0].w).toBe(640)
  })

  it('treats a missing field as no images', () => {
    expect(entryImages(makeEntry('hi', 0, 'x'))).toEqual([])
  })
})

describe('db with images', () => {
  beforeEach(async () => {
    await m.db.entries.where('id').notEqual('legacy').delete()
    await m.db.thumbs.clear()
    await m.db.blobs.clear()
  })

  it('upgrades a v1 database without losing entries', async () => {
    const legacy = await m.db.entries.get('legacy')
    expect(legacy?.text).toBe('written before images existed #old')
    expect(entryImages(legacy!)).toEqual([])
    expect(m.db.verno).toBe(2)
  })

  it('adds an entry with images; text is still required', async () => {
    const e = await m.addEntry('  with photos  ', [IMG_A])
    expect((await m.db.entries.get(e!.id))?.images).toEqual([IMG_A])
    expect(await m.addEntry('   ', [IMG_A])).toBeNull()
  })

  it('updateEntryText keeps images', async () => {
    const e = await m.addEntry('before', [IMG_A, IMG_B])
    await m.updateEntryText(e!.id, 'after')
    const got = await m.db.entries.get(e!.id)
    expect(got?.text).toBe('after')
    expect(got?.images).toEqual([IMG_A, IMG_B])
  })

  it('renameTag keeps images', async () => {
    const e = await m.addEntry('note #work', [IMG_A])
    expect(await m.renameTag('work', 'job')).toBe(1)
    const got = await m.db.entries.get(e!.id)
    expect(got?.text).toBe('note #job')
    expect(got?.images).toEqual([IMG_A])
  })

  it('deleteEntry keeps images on the tombstone', async () => {
    const e = await m.addEntry('gone', [IMG_A])
    await m.deleteEntry(e!.id)
    const got = await m.db.entries.get(e!.id)
    expect(got?.deleted).toBe(1)
    expect(got?.images).toEqual([IMG_A])
  })

  it('setEntryImages replaces images, bumps updatedAt and marks dirty', async () => {
    const e = await m.addEntry('x', [IMG_A])
    await m.db.entries.update(e!.id, { dirty: 0 })
    await m.setEntryImages(e!.id, [IMG_B])
    const got = await m.db.entries.get(e!.id)
    expect(got?.images).toEqual([IMG_B])
    expect(got!.updatedAt).toBeGreaterThan(e!.updatedAt)
    expect(got?.dirty).toBe(1)

    await m.setEntryImages(e!.id, [])
    expect('images' in (await m.db.entries.get(e!.id))!).toBe(false)
  })

  it('updateEntry saves text and images with one bump, and only when something changed', async () => {
    const e = await m.addEntry('text', [IMG_A])
    expect(await m.updateEntry(e!.id, 'text', [IMG_A])).toBe(false)
    expect((await m.db.entries.get(e!.id))!.updatedAt).toBe(e!.updatedAt)
    expect(await m.updateEntry(e!.id, 'text', [IMG_A, IMG_B])).toBe(true) // image-only change
    const got = (await m.db.entries.get(e!.id))!
    expect(got.images).toEqual([IMG_A, IMG_B])
    expect(got.updatedAt).toBeGreaterThan(e!.updatedAt)
    expect(await m.updateEntry(e!.id, '   ', [])).toBe(false) // text is required
    expect((await m.db.entries.get(e!.id))!.images).toEqual([IMG_A, IMG_B])
  })

  it('stores thumbnails and originals in their own tables', async () => {
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })
    await m.db.blobs.put({ hash: IMG_A.hash, blob, mime: 'image/jpeg', size: 3, onRemote: 0, addedAt: 1 })
    await m.db.thumbs.put({ hash: IMG_A.hash, blob, w: 512, h: 384 })
    expect(await m.db.blobs.where('onRemote').equals(0).count()).toBe(1)
    expect((await m.db.thumbs.get(IMG_A.hash))?.w).toBe(512)
  })
})

describe('cached originals', () => {
  const row = (hash: string, size: number, onRemote: 0 | 1, addedAt: number) =>
    ({ hash, blob: new Blob([new Uint8Array(size)]), mime: 'image/jpeg', size, onRemote, addedAt })

  beforeEach(async () => { await m.db.blobs.clear() })

  it('a downloaded original is kept as confirmed by storage, and never replaces one already there', async () => {
    const mine = row('a', 5, 0, 1)
    await m.db.blobs.put(mine)
    await m.saveFetchedOriginal('a', new Blob([new Uint8Array(5)]), 'image/jpeg')
    expect((await m.db.blobs.get('a'))?.onRemote).toBe(0) // unchanged: storage hasn't confirmed this device's copy
    await m.saveFetchedOriginal('b', new Blob([new Uint8Array(7)]), 'image/png')
    expect(await m.db.blobs.get('b')).toMatchObject({ size: 7, mime: 'image/png', onRemote: 1 })
  })

  it('drops the least recently used confirmed originals beyond the limit, never unconfirmed or held ones', async () => {
    await m.db.blobs.bulkPut([row('old', 10, 1, 1), row('only-copy', 10, 0, 0), row('held', 10, 1, 2), row('new', 10, 1, 3)])
    await m.touchOriginal('old') // just viewed: now the most recent
    expect(await m.evictOriginals(30, new Set(['held']))).toEqual(['new']) // 40 bytes in total
    expect(await m.evictOriginals(5, new Set(['held']))).toEqual(['old'])
    expect((await m.db.blobs.toCollection().primaryKeys()).sort()).toEqual(['held', 'only-copy'])
  })

  const MB = 1024 * 1024
  const big = (hash: string, mb: number, onRemote: 0 | 1, addedAt: number) => ({ ...row(hash, 1, onRemote, addedAt), size: mb * MB })

  it('the cache limit defaults to 1 GB and is remembered', async () => {
    await m.db.meta.delete('originalsLimit')
    expect(await m.getOriginalsLimit()).toBe(1024 * MB)
    await m.setOriginalsLimit(256 * MB)
    expect(await m.getOriginalsLimit()).toBe(256 * MB)
    await m.setOriginalsLimit(0)
    expect(await m.getOriginalsLimit()).toBe(0) // 0 = no limit, and must not turn back into the default
  })

  it('an invalid saved limit falls back to the default instead of dropping photos', async () => {
    await m.db.meta.put({ key: 'originalsLimit', value: 5 })
    expect(await m.getOriginalsLimit()).toBe(1024 * MB)
    await m.setOriginalsLimit(7)
    expect(await m.getOriginalsLimit()).toBe(1024 * MB)
  })

  it('trimming follows the saved limit: a lower one drops more, no limit drops nothing, unconfirmed ones always stay', async () => {
    await m.db.blobs.bulkPut([big('a', 200, 1, 1), big('b', 200, 1, 2), big('c', 200, 0, 3), big('d', 200, 1, 4)])
    await m.setOriginalsLimit(1024 * MB)
    expect(await m.evictOriginalsToLimit()).toEqual([]) // 800 MB fits in 1 GB
    await m.setOriginalsLimit(512 * MB)
    expect(await m.evictOriginalsToLimit()).toEqual(['a', 'b']) // 800 -> 400 MB, oldest confirmed first
    await m.setOriginalsLimit(256 * MB)
    expect(await m.evictOriginalsToLimit(new Set(['d']))).toEqual([]) // 'd' is on screen, 'c' is the only copy
    await m.setOriginalsLimit(256 * MB)
    expect(await m.evictOriginalsToLimit()).toEqual(['d']) // still over; 'c' is never dropped
    await m.db.blobs.bulkPut([big('e', 5000, 1, 5)])
    await m.setOriginalsLimit(0)
    expect(await m.evictOriginalsToLimit()).toEqual([]) // no limit
    expect((await m.db.blobs.toCollection().primaryKeys()).sort()).toEqual(['c', 'e'])
  })

  it('photoUsage adds up originals, those storage has not confirmed, and thumbnails', async () => {
    await m.db.blobs.clear()
    await m.db.thumbs.clear()
    expect(await m.photoUsage()).toEqual({ originals: 0, originalBytes: 0, unsavedOriginals: 0, unsavedBytes: 0, thumbs: 0, thumbBytes: 0 })
    await m.db.blobs.bulkPut([row('a', 10, 1, 1), row('b', 5, 0, 2), row('c', 7, 0, 3)])
    await m.db.thumbs.bulkPut([
      { hash: 'a', blob: new Blob([new Uint8Array(3)]), w: 1, h: 1 },
      { hash: 'b', blob: new Blob([new Uint8Array(4)]), w: 1, h: 1 },
    ])
    expect(await m.photoUsage()).toEqual({ originals: 3, originalBytes: 22, unsavedOriginals: 2, unsavedBytes: 12, thumbs: 2, thumbBytes: 7 })
    await m.db.blobs.clear()
    await m.db.thumbs.clear()
  })
})
