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
