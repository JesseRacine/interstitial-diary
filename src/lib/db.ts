import Dexie, { type Table } from 'dexie'
import { type CachedOriginal, ORIGINALS_CACHE_BYTES, chooseEvictions, limitBytes, normaliseLimit } from '../storage/originals'
import { type Entry, type ImageRef, extractTags, makeEntry, replaceTag, sameImages, withDerived } from './entry'

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
    // v3: people (@name) and places (~name) are tags too. Recalculate the derived tags of the entries already here.
    // Only `tags` changes: dirty and updatedAt stay, because the text is the same and nothing needs to sync.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Entry, string>('entries')
          .toCollection()
          .modify((e) => {
            e.tags = extractTags(e.text)
          }),
      )
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

/** Sizes of this device's copies of a photo (0 when absent). */
export async function localImageSizes(hash: string): Promise<{ original: number; thumb: number }> {
  return { original: (await db.blobs.get(hash))?.size ?? 0, thumb: (await db.thumbs.get(hash))?.blob.size ?? 0 }
}

/**
 * Remove these photos' original and thumbnail from this device, but NOT any that a live entry uses. The check and the
 * delete are one transaction, so an entry saved a moment ago (even with a photo attached just now) can't lose its
 * photo. Only for the user-confirmed cleanup of photos of deleted entries. Returns the hashes removed.
 */
export async function removeLocalImagesUnlessUsed(hashes: string[]): Promise<string[]> {
  return db.transaction('rw', db.entries, db.blobs, db.thumbs, async () => {
    const live = new Set<string>()
    await db.entries.each((e) => { if (!e.deleted) for (const i of e.images ?? []) live.add(i.hash) })
    const drop = hashes.filter((h) => !live.has(h))
    await db.blobs.bulkDelete(drop)
    await db.thumbs.bulkDelete(drop)
    return drop
  })
}

const ORIGINALS_LIMIT_KEY = 'originalsLimit'

/** The saved cache limit in bytes (0 = no limit); the default if nothing valid is saved. */
export async function getOriginalsLimit(): Promise<number> {
  return normaliseLimit(await getMeta<unknown>(ORIGINALS_LIMIT_KEY, ORIGINALS_CACHE_BYTES))
}

export async function setOriginalsLimit(bytes: number): Promise<void> {
  await setMeta(ORIGINALS_LIMIT_KEY, normaliseLimit(bytes))
}

/** evictOriginals with the saved limit. The same rule applies: the CALLER must only call it when storage is a separate copy. */
export async function evictOriginalsToLimit(keep: ReadonlySet<string> = new Set()): Promise<string[]> {
  return evictOriginals(limitBytes(await getOriginalsLimit()), keep)
}

/** What this device holds for photos, for Settings. Sizes are the stored files' sizes. */
export interface PhotoUsage {
  originals: number
  originalBytes: number
  unsavedOriginals: number // originals storage hasn't confirmed (never dropped automatically)
  unsavedBytes: number
  thumbs: number
  thumbBytes: number
}

export async function photoUsage(): Promise<PhotoUsage> {
  const u: PhotoUsage = { originals: 0, originalBytes: 0, unsavedOriginals: 0, unsavedBytes: 0, thumbs: 0, thumbBytes: 0 }
  await db.blobs.each((b) => {
    u.originals++
    u.originalBytes += b.size
    if (!b.onRemote) { u.unsavedOriginals++; u.unsavedBytes += b.size }
  })
  await db.thumbs.each((t) => { u.thumbs++; u.thumbBytes += t.blob.size })
  return u
}

/**
 * "Start over" on this device: delete every entry (incl. deleted ones' tombstones), every photo original and
 * thumbnail, and what was remembered about syncing them (`sync:*`, `images:*`). Settings, the chosen storage and the
 * backup/reminder dates stay. Can't be undone; only storage/manager.ts calls it, after the user confirmed or after
 * another device started over.
 */
export async function eraseLocalJournal(): Promise<void> {
  await db.transaction('rw', db.entries, db.blobs, db.thumbs, db.meta, async () => {
    await db.entries.clear()
    await db.blobs.clear()
    await db.thumbs.clear()
    const keys = (await db.meta.toCollection().primaryKeys()).filter((k) => /^(sync|images):/.test(String(k)))
    await db.meta.bulkDelete(keys)
  })
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
