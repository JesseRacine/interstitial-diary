import Dexie, { type Table } from 'dexie'
import { type CachedOriginal, chooseEvictions } from '../storage/originals'
import { type Entry, type ImageRef, makeEntry, replaceTag, sameImages, withDerived } from './entry'

export interface Meta {
  key: string
  value: unknown
}

/** A rebuildable thumbnail (about 512 px wide, WebP). */
export interface ThumbRow {
  hash: string
  blob: Blob
  w: number // size of the ORIGINAL after EXIF rotation (the thumbnail's own size is in the blob)
  h: number
}

/**
 * The full original of an attached image, byte for byte. Saved when the image is attached, before the entry is saved,
 * so a lost edit can only lose the reference, never the photo.
 */
export interface BlobRow {
  hash: string
  blob: Blob
  mime: string
  size: number
  onRemote: 0 | 1 // the active storage module confirmed it has the file
  addedAt: number
  usedAt?: number // last opened full size; with addedAt, decides which cached originals go first
}

class DiaryDB extends Dexie {
  entries!: Table<Entry, string>
  meta!: Table<Meta, string>
  thumbs!: Table<ThumbRow, string>
  blobs!: Table<BlobRow, string>

  constructor() {
    super('interstitial-diary')
    this.version(1).stores({
      entries: 'id, createdAt, day, *tags, dirty',
      meta: 'key',
    })
    // v2: images. Entries need no migration: a missing `images` field means no images.
    this.version(2).stores({
      thumbs: 'hash',
      blobs: 'hash, onRemote',
    })
  }
}

export const db = new DiaryDB()

const nextStamp = (prev: number) => Math.max(Date.now(), prev + 1)

/** Text is required; images are optional. */
export async function addEntry(text: string, images: ImageRef[] = []): Promise<Entry | null> {
  const t = text.trim()
  if (!t) return null
  const e = makeEntry(t, Date.now(), undefined, images)
  await db.entries.add(e)
  return e
}

export async function updateEntryText(id: string, text: string): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.put(withDerived({ ...e, text: text.trim(), updatedAt: nextStamp(e.updatedAt), dirty: 1 }))
}

/**
 * Save an edit of text and images together (one updatedAt bump). Text is required: an empty text leaves the entry as
 * it was. Returns whether anything changed.
 */
export async function updateEntry(id: string, text: string, images: ImageRef[]): Promise<boolean> {
  const t = text.trim()
  const e = await db.entries.get(id)
  if (!e || !t) return false
  if (t === e.text && sameImages(e, { images })) return false
  await db.entries.put(withDerived({ ...e, text: t, images, updatedAt: nextStamp(e.updatedAt), dirty: 1 }))
  return true
}

/** Replace an entry's images (add, remove or reorder). */
export async function setEntryImages(id: string, images: ImageRef[]): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.put(withDerived({ ...e, images, updatedAt: nextStamp(e.updatedAt), dirty: 1 }))
}

/** Soft delete: kept as a tombstone so the deletion can sync to other devices. Its images are kept too. */
export async function deleteEntry(id: string): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.put({ ...e, deleted: 1, updatedAt: nextStamp(e.updatedAt), dirty: 1 })
}

/** Rename (or merge into an existing) tag across all entries. Returns how many entries changed. */
export async function renameTag(from: string, to: string): Promise<number> {
  const affected = (await db.entries.where('tags').equals(from).toArray()).filter((e) => !e.deleted)
  const updated = affected.map((e) =>
    withDerived({ ...e, text: replaceTag(e.text, from, to), updatedAt: nextStamp(e.updatedAt), dirty: 1 }),
  )
  await db.entries.bulkPut(updated)
  return updated.length
}

/** Note that an original was just viewed (it is kept longer in the cache). */
export async function touchOriginal(hash: string): Promise<void> {
  await db.blobs.update(hash, { usedAt: Date.now() })
}

/**
 * Keep an original downloaded from storage. Never replaces a row that is already there (the bytes are the same,
 * and the existing row's onRemote is the truth). Returns the blob that is now stored.
 */
export async function saveFetchedOriginal(hash: string, blob: Blob, mime: string): Promise<Blob> {
  return db.transaction('rw', db.blobs, async () => {
    const existing = await db.blobs.get(hash)
    if (existing) return existing.blob
    const now = Date.now()
    await db.blobs.add({ hash, blob, mime, size: blob.size, onRemote: 1, addedAt: now, usedAt: now })
    return blob
  })
}

/**
 * Drop cached originals beyond `limit` bytes (see chooseEvictions: only ones storage confirmed, least recently used
 * first, never those in `keep`). The CALLER must only call this when the active storage is a separate copy.
 * Returns the hashes dropped.
 */
export async function evictOriginals(limit: number, keep: ReadonlySet<string> = new Set()): Promise<string[]> {
  return db.transaction('rw', db.blobs, async () => {
    const rows: CachedOriginal[] = []
    await db.blobs.each((r) => { rows.push({ hash: r.hash, size: r.size, onRemote: r.onRemote, addedAt: r.addedAt, usedAt: r.usedAt }) })
    const drop = chooseEvictions(rows, limit, keep)
    await db.blobs.bulkDelete(drop)
    return drop
  })
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
