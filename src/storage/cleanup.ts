import { type Entry, entryImages } from '../lib/entry'
import { imagePath, thumbPath } from '../lib/images'
import { type FileStore, supportsBlobRemoval } from './types'

/*
 * "Remove photos of deleted entries": the only place image files are ever deleted, and only when the user asks and
 * confirms. Backend-agnostic, like attachments.ts. The rules, every one of them there to avoid losing a photo:
 *
 * - A photo is a candidate only if a DELETED entry this device knows about uses it and NO live entry uses it (anywhere,
 *   in any year). An image the app has never seen referenced (e.g. uploaded by another device whose day file hasn't
 *   arrived yet) is never touched, because nothing here names it.
 * - Only the paths those deleted entries imply are touched: `<year>/images/<hash>.<ext>` for their own years, and
 *   `.thumbs/<hash>.webp`. Names are checked against the same patterns the file parser accepts before a path is built.
 * - Nothing is decided from a stale view: `removeUnusedImages` works from the entries as they are NOW and only removes
 *   photos the user was shown (`approved`) that are still unused.
 * - If a file in storage can't be removed, the photo's copy on this device is kept too, and it is reported.
 * - Paths that were removed are forgotten from `confirmed` (the per-storage list of paths known to exist), so a photo
 *   attached again later is written to storage again instead of being assumed to be there.
 * - The copy on this device is removed in one database transaction that re-checks the live entries (`removeLocal`).
 */

const SAFE_HASH = /^[0-9a-f]{8,64}$/
const SAFE_EXT = /^[a-z0-9]{1,5}$/
const SAFE_YEAR = /^\d{4}$/

/** What this device holds locally for a photo. */
export interface CleanupLocal {
  snapshot(): Promise<Entry[]> // all entries, including deleted ones
  localSizes(hash: string): Promise<{ original: number; thumb: number }> // 0 when this device doesn't have it
  /**
   * Remove these photos' original and thumbnail from this device, atomically skipping any that a live entry uses at
   * that moment. Returns the hashes actually removed.
   */
  removeLocal(hashes: string[]): Promise<string[]>
}

export interface UnusedImage {
  hash: string
  paths: string[] // original paths implied by the deleted entries that used it, plus its thumbnail path
}

/**
 * Photos used only by deleted entries, from the entries this device knows: sorted by hash, each with the storage paths
 * to look at. Pure. A photo any live entry uses is never listed, whatever year or extension.
 */
export function unusedImages(entries: readonly Entry[]): UnusedImage[] {
  const live = new Set<string>()
  for (const e of entries) if (!e.deleted) for (const i of entryImages(e)) live.add(i.hash)

  const found = new Map<string, Set<string>>()
  for (const e of entries) {
    if (!e.deleted) continue
    for (const i of entryImages(e)) {
      if (live.has(i.hash)) continue
      const year = e.day.slice(0, 4)
      if (!SAFE_HASH.test(i.hash) || !SAFE_EXT.test(i.ext) || !SAFE_YEAR.test(year)) continue // can't be a file we wrote
      const paths = found.get(i.hash) ?? new Set<string>([thumbPath(i.hash)])
      paths.add(imagePath(e.day, i))
      found.set(i.hash, paths)
    }
  }
  return [...found].sort(([a], [b]) => a.localeCompare(b)).map(([hash, paths]) => ({ hash, paths: [...paths].sort() }))
}

export interface CleanupPlan {
  hashes: string[] // the photos that have something to remove (what the user approves)
  storageBytes: number // files found in storage (originals and thumbnails)
  storageFiles: number
  localBytes: number // originals and thumbnails on this device
  storageRemovable: boolean // false when a storage is connected that can't delete files: only this device is cleaned
}

/** Look at what could be removed and how much space it frees. Changes nothing. */
export async function planCleanup(local: CleanupLocal, store: FileStore | null): Promise<CleanupPlan> {
  const storage = store && supportsBlobRemoval(store) ? store : null
  const plan: CleanupPlan = { hashes: [], storageBytes: 0, storageFiles: 0, localBytes: 0, storageRemovable: !store || !!storage }
  for (const img of unusedImages(await local.snapshot())) {
    let found = false
    if (storage) {
      for (const path of img.paths) {
        const there = await storage.hasBlob(path)
        if (!there) continue
        found = true
        plan.storageFiles++
        plan.storageBytes += there.size
      }
    }
    const sizes = await local.localSizes(img.hash)
    if (sizes.original || sizes.thumb) {
      found = true
      plan.localBytes += sizes.original + sizes.thumb
    }
    if (found) plan.hashes.push(img.hash)
  }
  return plan
}

export interface CleanupResult {
  removed: number // photos taken off this device and out of storage
  files: number // files deleted from storage
  freedBytes: number
  errors: string[] // photos left as they were (and why)
  confirmed: Set<string> // the updated list of paths known to be in storage
}

/**
 * Remove the approved photos, working from the entries as they are now. A photo someone started using since the plan was
 * made is skipped. Never throws for a single file: it is reported and left alone. `confirmed` is the per-storage list of
 * paths known to exist (see attachments.ts); removed paths are taken out of the returned copy.
 */
export async function removeUnusedImages(
  local: CleanupLocal,
  store: FileStore | null,
  approved: ReadonlySet<string>,
  confirmed: ReadonlySet<string>,
): Promise<CleanupResult> {
  const storage = store && supportsBlobRemoval(store) ? store : null
  const result: CleanupResult = { removed: 0, files: 0, freedBytes: 0, errors: [], confirmed: new Set(confirmed) }
  const done: string[] = [] // photos whose storage files are gone (or that have none): safe to drop locally

  for (const img of unusedImages(await local.snapshot())) {
    if (!approved.has(img.hash)) continue
    let ok = true
    if (storage) {
      for (const path of img.paths) {
        try {
          const there = await storage.hasBlob(path)
          if (there) {
            await storage.removeBlob(path)
            result.files++
            result.freedBytes += there.size
          }
          result.confirmed.delete(path) // gone (or never there): don't assume it exists any more
        } catch (e) {
          ok = false
          result.errors.push(`${path}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
    if (ok) done.push(img.hash)
  }

  if (done.length) {
    const sizes = new Map<string, number>()
    for (const h of done) {
      const s = await local.localSizes(h)
      sizes.set(h, s.original + s.thumb)
    }
    // Re-checks the live entries atomically. A photo skipped here was picked up by an entry since the snapshot: its copy
    // on this device is kept, and the next sync writes its files back to storage (their paths are no longer confirmed).
    const removed = await local.removeLocal(done)
    for (const h of removed) result.freedBytes += sizes.get(h) ?? 0
    result.removed = removed.length
  }
  return result
}
