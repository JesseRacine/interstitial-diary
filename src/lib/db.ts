import Dexie, { type Table } from 'dexie'
import { type Entry, type ImageRef, makeEntry, replaceTag, withDerived } from './entry'

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

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
