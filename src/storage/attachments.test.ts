import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from '../lib/entry'
import type { ImageLocal } from './attachments'
import { pushImages } from './attachments'
import { memoryLocal, memoryStore } from './memory'
import { emptySyncState } from './sync'
import { syncAll } from './syncAll'
import type { FileStore, SyncState } from './types'

const at = (y: number, d: number, h: number) => new Date(y, 10, d, h).getTime()
const A: ImageRef = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 4, h: 3 }
const B: ImageRef = { hash: 'bbbbbbbbbbbbbbbb', ext: 'heic', w: 0, h: 0 } // stored, no thumbnail
const bytes = (n: number) => new Blob([new Uint8Array(n).fill(7)])

/** A device with entries plus the image bytes it holds locally. */
function device(entries: Entry[], originals: Record<string, Blob> = {}, thumbs: Record<string, Blob> = {}) {
  const local = memoryLocal(entries)
  const onRemote = new Set<string>()
  const images: ImageLocal = {
    snapshot: () => local.snapshot(),
    original: async (h) => originals[h] ?? null,
    thumb: async (h) => thumbs[h] ?? null,
    markOnRemote: async (h) => { onRemote.add(h) },
  }
  let state: SyncState = emptySyncState()
  let confirmed = new Set<string>()
  return {
    local, images, onRemote,
    async sync(store: FileStore) {
      const r = await syncAll(local, images, store, state, confirmed)
      state = r.state
      confirmed = r.confirmed
      return r
    },
  }
}

/** Records every write, text and binary, in order. */
function loggingStore() {
  const store = memoryStore()
  const log: string[] = []
  const write = store.write.bind(store)
  const writeBlob = store.writeBlob.bind(store)
  store.write = async (p, c) => { log.push(p); return write(p, c) }
  store.writeBlob = async (p, b) => { log.push(p); return writeBlob(p, b) }
  return { store, log }
}

describe('pushing images to storage', () => {
  it('writes originals and thumbnails before the day file that refers to them', async () => {
    const { store, log } = loggingStore()
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) }, { [A.hash]: bytes(3) })
    const r = await d.sync(store)
    expect(log).toEqual(['2026/images/aaaaaaaaaaaaaaaa.jpg', '.thumbs/aaaaaaaaaaaaaaaa.webp', '2026/2026-11-08.md'])
    expect(r.images).toEqual({ written: 2, pending: 0, errors: [] })
    expect(d.onRemote.has(A.hash)).toBe(true)
    expect(await store.readBlob('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe((await d.images.original(A.hash)))
    expect(await store.list()).toHaveLength(1) // images never show up in list()
  })

  it('a failed image write does not block or fail the text sync, and is retried next time', async () => {
    const { store } = loggingStore()
    const realWriteBlob = store.writeBlob.bind(store)
    store.writeBlob = async () => { throw new Error('disk full') }
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) }, { [A.hash]: bytes(3) })

    const r1 = await d.sync(store)
    expect(store.files.has('2026/2026-11-08.md')).toBe(true) // text got through
    expect(r1.images).toMatchObject({ written: 0, pending: 2 })
    expect(r1.images!.errors[0]).toBe('disk full')
    expect(d.onRemote.size).toBe(0) // not stored anywhere yet

    store.writeBlob = realWriteBlob
    const r2 = await d.sync(store)
    expect(r2.images).toEqual({ written: 2, pending: 0, errors: [] })
    expect(store.blobs.has('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(true)
    expect(d.onRemote.has(A.hash)).toBe(true)
  })

  it('even an unexpected crash in the image pass leaves the text sync running', async () => {
    const store = memoryStore()
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])])
    d.images.original = async () => { throw new Error('database closed') }
    const r = await d.sync(store)
    expect(store.files.has('2026/2026-11-08.md')).toBe(true)
    expect(r.images?.errors).toEqual(['database closed'])
  })

  it('a text sync failure still fails the run', async () => {
    const store = memoryStore()
    store.write = async () => { throw new Error('read-only') }
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) })
    await expect(d.sync(store)).rejects.toThrow('read-only')
  })

  it('stores a photo once per year that uses it; the thumbnail once', async () => {
    const store = memoryStore()
    const d = device(
      [makeEntry('2025', at(2025, 1, 9), 'x', [A]), makeEntry('2026', at(2026, 1, 9), 'y', [A]), makeEntry('again', at(2026, 2, 9), 'z', [A])],
      { [A.hash]: bytes(10) }, { [A.hash]: bytes(3) },
    )
    await d.sync(store)
    expect([...store.blobs.keys()].sort()).toEqual(['.thumbs/aaaaaaaaaaaaaaaa.webp', '2025/images/aaaaaaaaaaaaaaaa.jpg', '2026/images/aaaaaaaaaaaaaaaa.jpg'])
  })

  it('a second sync with nothing new does not touch image files', async () => {
    const store = memoryStore()
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) }, { [A.hash]: bytes(3) })
    await d.sync(store)
    let calls = 0
    const has = store.hasBlob.bind(store)
    store.hasBlob = async (p) => { calls++; return has(p) }
    const r = await d.sync(store)
    expect(calls).toBe(0)
    expect(r.images).toEqual({ written: 0, pending: 0, errors: [] })
  })

  it('a file already in storage with the same size is accepted without writing', async () => {
    const store = memoryStore()
    store.blobs.set('2026/images/aaaaaaaaaaaaaaaa.jpg', bytes(10)) // e.g. written by another device
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) })
    const r = await d.sync(store)
    expect(r.images?.written).toBe(0)
    expect(d.onRemote.has(A.hash)).toBe(true)
  })

  it('a different file with the same name is an error, never an overwrite', async () => {
    const store = memoryStore()
    const theirs = bytes(99)
    store.blobs.set('2026/images/aaaaaaaaaaaaaaaa.jpg', theirs)
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) })
    const r = await d.sync(store)
    expect(store.blobs.get('2026/images/aaaaaaaaaaaaaaaa.jpg')).toBe(theirs)
    expect(r.images?.pending).toBe(1)
    expect(r.images?.errors[0]).toMatch(/different content/)
    expect(d.onRemote.has(A.hash)).toBe(false)
    expect(store.files.has('2026/2026-11-08.md')).toBe(true)
  })

  it('writeBlob itself refuses to overwrite a different file', async () => {
    const store = memoryStore()
    await store.writeBlob('x.jpg', bytes(5))
    await store.writeBlob('x.jpg', bytes(5)) // same size: fine, nothing happens
    await expect(store.writeBlob('x.jpg', bytes(6))).rejects.toThrow(/different content/)
    expect(store.blobs.get('x.jpg')!.size).toBe(5)
  })

  it('deleting an entry never removes its image files', async () => {
    const store = memoryStore()
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) }, { [A.hash]: bytes(3) })
    await d.sync(store)
    const e = d.local.entries.get('x')!
    d.local.entries.set('x', { ...e, deleted: 1, dirty: 1, updatedAt: e.updatedAt + 1 })
    await d.sync(store)
    expect(store.files.has('2026/2026-11-08.md')).toBe(false) // the emptied day file goes
    expect(store.blobs.size).toBe(2) // the photo and its thumbnail stay
  })

  it('skips images this device does not have, and formats without a thumbnail', async () => {
    const store = memoryStore()
    const d = device([makeEntry('two', at(2026, 8, 9), 'x', [A, B])], { [B.hash]: bytes(10) })
    const r = await d.sync(store)
    expect([...store.blobs.keys()]).toEqual(['2026/images/bbbbbbbbbbbbbbbb.heic'])
    expect(r.images).toEqual({ written: 1, pending: 0, errors: [] })
  })

  it('a storage module without binary support still syncs text', async () => {
    const { readBlob: _r, writeBlob: _w, hasBlob: _h, ...textOnly } = memoryStore()
    const d = device([makeEntry('photo', at(2026, 8, 9), 'x', [A])], { [A.hash]: bytes(10) })
    const r = await d.sync(textOnly)
    expect(r.images).toBeNull()
    expect(r.report.written).toBe(1)
  })

  it('pushImages keeps the confirmed paths it was given', async () => {
    const store = memoryStore()
    const d = device([], {})
    const r = await pushImages(d.images, store, new Set(['2020/images/old.jpg']))
    expect([...r.confirmed]).toEqual(['2020/images/old.jpg'])
  })
})
