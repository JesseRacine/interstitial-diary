import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from '../lib/entry'
import { type ImageLocal, pushImages } from './attachments'
import { type CleanupLocal, planCleanup, removeUnusedImages, unusedImages } from './cleanup'
import { memoryLocal, memoryStore } from './memory'
import { emptySyncState } from './sync'
import { syncAll } from './syncAll'
import type { FileStore, SyncState } from './types'

const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime()
const ref = (c: string, ext = 'jpg'): ImageRef => ({ hash: c.repeat(16), ext, w: 4, h: 3 })
const A = ref('a')
const B = ref('b')
const C = ref('c')
const bytes = (n: number) => new Blob([new Uint8Array(n).fill(7)])
const deleted = (e: Entry): Entry => ({ ...e, deleted: 1, updatedAt: e.updatedAt + 1000, dirty: 1 })

/** A device: entries plus the image bytes it holds, with the same rules as the real CleanupLocal (db.ts). */
function device(entries: Entry[], originals: Record<string, Blob> = {}, thumbs: Record<string, Blob> = {}) {
  const local = memoryLocal(entries)
  const onRemote = new Set<string>()
  const images: ImageLocal = {
    snapshot: () => local.snapshot(),
    original: async (h) => originals[h] ?? null,
    thumb: async (h) => thumbs[h] ?? null,
    markOnRemote: async (h) => { onRemote.add(h) },
    unsaved: async () => Object.keys(originals).filter((h) => !onRemote.has(h)),
    saveThumb: async (h, b) => { thumbs[h] = b },
    thumbnail: async (b) => ({ w: 40, h: 30, thumb: bytes(Math.max(1, b.size >> 1)), tw: 4, th: 3 }),
  }
  const cleanup: CleanupLocal = {
    snapshot: () => local.snapshot(),
    localSizes: async (h) => ({ original: originals[h]?.size ?? 0, thumb: thumbs[h]?.size ?? 0 }),
    async removeLocal(hashes) {
      const live = new Set<string>()
      for (const e of local.entries.values()) if (!e.deleted) for (const i of e.images ?? []) live.add(i.hash)
      const drop = hashes.filter((h) => !live.has(h))
      for (const h of drop) { delete originals[h]; delete thumbs[h] }
      return drop
    },
  }
  let state: SyncState = emptySyncState()
  let confirmed = new Set<string>()
  return {
    local, images, cleanup, originals, thumbs,
    get confirmed() { return confirmed },
    set confirmed(c: Set<string>) { confirmed = c },
    async sync(store: FileStore) {
      const r = await syncAll(local, images, store, state, confirmed)
      state = r.state
      confirmed = r.confirmed
      return r
    },
  }
}

/** A device whose entry E1 (with photo A) was deleted, everything synced to storage. */
async function deletedPhotoSetup() {
  const store = memoryStore()
  const d = device([makeEntry('photo', at(8), 'e1', [A])], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
  await d.sync(store)
  d.local.entries.set('e1', deleted(d.local.entries.get('e1')!))
  await d.sync(store)
  return { store, d }
}

describe('unusedImages', () => {
  it('lists a photo only deleted entries use, with the paths those entries imply', () => {
    const e = deleted(makeEntry('gone', at(8), 'e1', [A]))
    expect(unusedImages([e])).toEqual([{ hash: A.hash, paths: ['.thumbs/aaaaaaaaaaaaaaaa.webp', '2026/images/aaaaaaaaaaaaaaaa.jpg'] }])
  })

  it('never lists a photo that a live entry uses, in any year or entry', () => {
    const gone = deleted(makeEntry('gone', at(8), 'e1', [A, B]))
    const liveSameYear = makeEntry('keep', at(9), 'e2', [A])
    const liveOtherYear = makeEntry('keep too', new Date(2025, 5, 1).getTime(), 'e3', [{ ...B, ext: 'png' }]) // same bytes name, other year
    expect(unusedImages([gone, liveSameYear, liveOtherYear])).toEqual([])
  })

  it('a photo used by a deleted entry in two years is looked for in both', () => {
    const a = deleted(makeEntry('a', new Date(2025, 11, 30).getTime(), 'e1', [A]))
    const b = deleted(makeEntry('b', at(8), 'e2', [A]))
    expect(unusedImages([a, b])[0].paths).toEqual(['.thumbs/aaaaaaaaaaaaaaaa.webp', '2025/images/aaaaaaaaaaaaaaaa.jpg', '2026/images/aaaaaaaaaaaaaaaa.jpg'])
  })

  it('ignores entries without photos, and live entries', () => {
    expect(unusedImages([deleted(makeEntry('x', at(8), 'e1')), makeEntry('y', at(8), 'e2', [A])])).toEqual([])
  })

  it('ignores names that could not be files the app wrote (no path is ever built from them)', () => {
    const evil = deleted(makeEntry('x', at(8), 'e1', [
      { hash: '../../x', ext: 'jpg', w: 0, h: 0 },
      { hash: A.hash, ext: '../md', w: 0, h: 0 },
      { hash: 'AAAAAAAAAAAAAAAA', ext: 'jpg', w: 0, h: 0 },
      { hash: 'abc', ext: 'jpg', w: 0, h: 0 },
    ]))
    expect(unusedImages([evil])).toEqual([])
  })

  it('is sorted and lists each photo once', () => {
    const e = deleted(makeEntry('x', at(8), 'e1', [C, A, B]))
    const f = deleted(makeEntry('y', at(8, 10), 'e2', [A]))
    expect(unusedImages([e, f]).map((u) => u.hash[0])).toEqual(['a', 'b', 'c'])
  })

  it('after a delete synced from another device, the entry still carries its photos, so they are found', async () => {
    const store = memoryStore()
    const one = device([makeEntry('photo', at(8), 'e1', [A])], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
    await one.sync(store)
    const two = device([])
    await two.sync(store)
    two.local.entries.set('e1', deleted(two.local.entries.get('e1')!))
    await two.sync(store) // tombstone
    await one.sync(store)
    expect(one.local.entries.get('e1')!.deleted).toBe(1)
    expect(unusedImages(await one.local.snapshot()).map((u) => u.hash)).toEqual([A.hash])
  })
})

describe('planCleanup', () => {
  it('adds up what is in storage and on this device, and changes nothing', async () => {
    const { store, d } = await deletedPhotoSetup()
    const before = [...store.blobs.keys()].sort()
    const plan = await planCleanup(d.cleanup, store)
    expect(plan).toEqual({ hashes: [A.hash], storageBytes: 110, storageFiles: 2, localBytes: 110, storageRemovable: true })
    expect([...store.blobs.keys()].sort()).toEqual(before)
    expect(d.originals[A.hash]).toBeDefined()
  })

  it('has nothing to remove when every photo is still used', async () => {
    const store = memoryStore()
    const d = device([makeEntry('photo', at(8), 'e1', [A])], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
    await d.sync(store)
    expect((await planCleanup(d.cleanup, store)).hashes).toEqual([])
  })

  it('leaves out a photo that is nowhere (nothing to remove)', async () => {
    const d = device([deleted(makeEntry('gone', at(8), 'e1', [A]))])
    expect((await planCleanup(d.cleanup, memoryStore())).hashes).toEqual([])
  })

  it('without storage, only this device is counted', async () => {
    const d = device([deleted(makeEntry('gone', at(8), 'e1', [A]))], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
    expect(await planCleanup(d.cleanup, null)).toEqual({ hashes: [A.hash], storageBytes: 0, storageFiles: 0, localBytes: 110, storageRemovable: true })
  })

  it('a storage that cannot delete files is left alone and the plan says so', async () => {
    const { store, d } = await deletedPhotoSetup()
    const readOnly: FileStore = { ...store, removeBlob: undefined }
    const plan = await planCleanup(d.cleanup, readOnly)
    expect(plan).toMatchObject({ storageBytes: 0, storageFiles: 0, localBytes: 110, storageRemovable: false })
  })
})

describe('removeUnusedImages', () => {
  it('removes the photo from storage and from this device, and forgets the removed paths', async () => {
    const { store, d } = await deletedPhotoSetup()
    expect([...d.confirmed].sort()).toEqual(['.thumbs/aaaaaaaaaaaaaaaa.webp', '2026/images/aaaaaaaaaaaaaaaa.jpg'])
    const r = await removeUnusedImages(d.cleanup, store, new Set([A.hash]), d.confirmed)
    expect(r).toMatchObject({ removed: 1, files: 2, freedBytes: 220, errors: [] })
    expect(store.blobs.size).toBe(0)
    expect(d.originals[A.hash]).toBeUndefined()
    expect(d.thumbs[A.hash]).toBeUndefined()
    expect(r.confirmed.size).toBe(0)
    expect((await planCleanup(d.cleanup, store)).hashes).toEqual([]) // nothing left to do
  })

  it('leaves the text alone: day files and tombstones are untouched', async () => {
    const { store, d } = await deletedPhotoSetup()
    const before = JSON.stringify([...store.files])
    await removeUnusedImages(d.cleanup, store, new Set([A.hash]), d.confirmed)
    expect(JSON.stringify([...store.files])).toBe(before)
    expect(d.local.entries.get('e1')!.deleted).toBe(1) // the deleted entry itself is as it was
  })

  it('only removes photos that were approved', async () => {
    const store = memoryStore()
    const d = device(
      [deleted(makeEntry('a', at(8), 'e1', [A])), deleted(makeEntry('b', at(8, 10), 'e2', [B]))],
      { [A.hash]: bytes(10), [B.hash]: bytes(20) },
    )
    await store.writeBlob('2026/images/aaaaaaaaaaaaaaaa.jpg', bytes(10))
    await store.writeBlob('2026/images/bbbbbbbbbbbbbbbb.jpg', bytes(20))
    const r = await removeUnusedImages(d.cleanup, store, new Set([A.hash]), new Set())
    expect(r.removed).toBe(1)
    expect([...store.blobs.keys()]).toEqual(['2026/images/bbbbbbbbbbbbbbbb.jpg'])
    expect(d.originals[B.hash]).toBeDefined()
  })

  it('skips a photo that a live entry started using after the plan was made', async () => {
    const { store, d } = await deletedPhotoSetup()
    const plan = await planCleanup(d.cleanup, store)
    d.local.entries.set('e2', makeEntry('same photo again', at(9), 'e2', [A])) // saved between plan and removal
    const r = await removeUnusedImages(d.cleanup, store, new Set(plan.hashes), d.confirmed)
    expect(r.removed).toBe(0)
    expect(store.blobs.size).toBe(2)
    expect(d.originals[A.hash]).toBeDefined()
  })

  it('the local removal re-checks the live entries itself, so an entry saved mid-way keeps its photo', async () => {
    const { store, d } = await deletedPhotoSetup()
    const racing: CleanupLocal = {
      ...d.cleanup,
      removeLocal: async (hashes) => {
        d.local.entries.set('e2', makeEntry('saved right now', at(9), 'e2', [A])) // lands just before the delete
        return d.cleanup.removeLocal(hashes)
      },
    }
    const r = await removeUnusedImages(racing, store, new Set([A.hash]), d.confirmed)
    expect(r.removed).toBe(0)
    expect(d.originals[A.hash]).toBeDefined() // the local copy survives, and the next sync writes the files back
    expect(r.confirmed.size).toBe(0) // ...because the removed paths are no longer assumed to exist
    const again = await pushImages(d.images, store, r.confirmed)
    expect(again.report.written).toBe(2)
    expect(store.blobs.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(true)
  })

  it('never touches files nothing refers to, nor anything outside the image folders', async () => {
    const { store, d } = await deletedPhotoSetup()
    await store.writeBlob('2026/images/cccccccccccccccc.jpg', bytes(5)) // uploaded by another device, no entry here yet
    await store.writeBlob('.thumbs/cccccccccccccccc.webp', bytes(2))
    await store.writeBlob('2026/images/notes.txt', bytes(2)) // a file the user put there
    const removed: string[] = []
    const real = store.removeBlob.bind(store)
    store.removeBlob = async (p) => { removed.push(p); return real(p) }
    await removeUnusedImages(d.cleanup, store, new Set([A.hash, C.hash]), d.confirmed)
    expect(removed.sort()).toEqual(['.thumbs/aaaaaaaaaaaaaaaa.webp', '2026/images/aaaaaaaaaaaaaaaa.jpg'])
    expect([...store.blobs.keys()].sort()).toEqual(['.thumbs/cccccccccccccccc.webp', '2026/images/cccccccccccccccc.jpg', '2026/images/notes.txt'])
  })

  it('a failure keeps this device\'s copy, reports it, and still forgets only the paths that were removed', async () => {
    const { store, d } = await deletedPhotoSetup()
    const real = store.removeBlob.bind(store)
    store.removeBlob = async (p) => { if (p.startsWith('2026/images/')) throw new Error('locked'); return real(p) }
    const r = await removeUnusedImages(d.cleanup, store, new Set([A.hash]), d.confirmed)
    expect(r.removed).toBe(0)
    expect(r.errors).toEqual(['2026/images/aaaaaaaaaaaaaaaa.jpg: locked'])
    expect(d.originals[A.hash]).toBeDefined() // not removed locally, since storage still has the original
    expect(store.blobs.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(true)
    expect(r.confirmed.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(true) // still there as far as we know
    expect(r.confirmed.has('.thumbs/aaaaaaaaaaaaaaaa.webp')).toBe(false) // that one was removed
    store.removeBlob = real
    const retry = await removeUnusedImages(d.cleanup, store, new Set([A.hash]), r.confirmed) // a later try finishes the job
    expect(retry).toMatchObject({ removed: 1, errors: [] })
    expect(store.blobs.size).toBe(0)
  })

  it('without storage it cleans this device only', async () => {
    const d = device([deleted(makeEntry('gone', at(8), 'e1', [A]))], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
    const r = await removeUnusedImages(d.cleanup, null, new Set([A.hash]), new Set())
    expect(r).toMatchObject({ removed: 1, files: 0, freedBytes: 110 })
    expect(d.originals[A.hash]).toBeUndefined()
  })

  it('a storage that cannot delete files is not touched', async () => {
    const { store, d } = await deletedPhotoSetup()
    const readOnly: FileStore = { ...store, removeBlob: undefined }
    const r = await removeUnusedImages(d.cleanup, readOnly, new Set([A.hash]), d.confirmed)
    expect(r.files).toBe(0)
    expect(store.blobs.size).toBe(2)
    expect(r.confirmed.size).toBe(2) // nothing was removed, so nothing is forgotten
  })

  it('a photo attached again after the cleanup is written to storage again (the forgotten paths matter)', async () => {
    const { store, d } = await deletedPhotoSetup()
    const r = await removeUnusedImages(d.cleanup, store, new Set([A.hash]), d.confirmed)
    d.confirmed = r.confirmed
    d.originals[A.hash] = bytes(100) // the user attaches the same photo to a new entry
    d.thumbs[A.hash] = bytes(10)
    d.local.entries.set('e2', makeEntry('again', at(10), 'e2', [A]))
    await d.sync(store)
    expect(store.blobs.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(true)
    expect(store.blobs.has('.thumbs/aaaaaaaaaaaaaaaa.webp')).toBe(true)

    // ...whereas remembering the old paths would have skipped the write and left the entry pointing at nothing.
    const stale = await deletedPhotoSetup()
    await removeUnusedImages(stale.d.cleanup, stale.store, new Set([A.hash]), stale.d.confirmed) // result deliberately ignored
    stale.d.originals[A.hash] = bytes(100)
    stale.d.local.entries.set('e2', makeEntry('again', at(10), 'e2', [A]))
    await stale.d.sync(stale.store)
    expect(stale.store.blobs.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(false)
  })

  it('removing the files of a deleted entry never makes another device lose a photo it still uses', async () => {
    // Device 1 deleted the entry that had photo A; device 2 still shows a live entry with A (the same photo, other entry).
    const store = memoryStore()
    const one = device([makeEntry('photo', at(8), 'e1', [A])], { [A.hash]: bytes(100) }, { [A.hash]: bytes(10) })
    await one.sync(store)
    const two = device([makeEntry('same photo', at(8, 12), 'e2', [A])])
    await two.sync(store) // device 2's entry reaches storage too
    one.local.entries.set('e1', deleted(one.local.entries.get('e1')!))
    await one.sync(store) // entries are merged: e2 arrives here as a live entry using A
    expect(one.local.entries.get('e2')).toBeDefined()
    expect(unusedImages(await one.local.snapshot())).toEqual([]) // A is in use, so it is never listed
    expect((await planCleanup(one.cleanup, store)).hashes).toEqual([])
  })
})
