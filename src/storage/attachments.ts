import { type Entry, type ImageRef, entryImages } from '../lib/entry'
import type { Thumbnailer } from '../lib/imageClient'
import { imagePath, isDisplayable, thumbPath } from '../lib/images'
import { BlobCollisionError, type BlobStore } from './types'

/*
 * Image passes, backend-agnostic like sync.ts. They run in their own try/catch around syncOnce (see manager.ts), so an
 * image problem never blocks or fails the text sync.
 *
 * pushImages runs BEFORE syncOnce, so normally an original is in storage before the day file that refers to it.
 * An original is written once per year folder that has a live entry using it (<year>/images/<hash>.<ext>), plus its
 * thumbnail (.thumbs/<hash>.webp). Paths confirmed to exist are remembered per storage module (`confirmed`), so a
 * sync with nothing new does no file access at all.
 *
 * Image files are never deleted here, not even when the entry using them is deleted.
 */

/** What the image passes need from the local database. */
export interface ImageLocal {
  snapshot(): Promise<Entry[]>
  original(hash: string): Promise<Blob | null> // the full original, if this device has it
  thumb(hash: string): Promise<Blob | null>
  markOnRemote(hash: string): Promise<void> // the storage module now has the original
  saveThumb(hash: string, blob: Blob, w: number, h: number): Promise<void> // w/h: the original's size, 0 if unknown
  thumbnail: Thumbnailer // makes a thumbnail from an original (the worker in the app)
}

export interface PushReport {
  written: number // files written this run
  pending: number // files still to write (failed this run; retried next sync)
  errors: string[]
}

interface Job {
  path: string
  hash: string
  kind: 'original' | 'thumb'
}

/** Every file storage should have, for images this device holds. Originals before thumbnails, in a stable order. */
async function wantedFiles(local: ImageLocal): Promise<Job[]> {
  const years = new Map<string, Set<string>>() // `${hash}.${ext}` -> years
  for (const e of await local.snapshot()) {
    if (e.deleted) continue
    for (const img of entryImages(e)) {
      const key = `${img.hash}.${img.ext}`
      const set = years.get(key) ?? new Set<string>()
      set.add(e.day.slice(0, 4))
      years.set(key, set)
    }
  }
  const originals: Job[] = []
  const thumbs: Job[] = []
  for (const [key, ys] of [...years].sort()) {
    const [hash, ext] = key.split('.')
    for (const y of [...ys].sort()) originals.push({ path: imagePath(`${y}-01-01`, { hash, ext }), hash, kind: 'original' })
    thumbs.push({ path: thumbPath(hash), hash, kind: 'thumb' })
  }
  return [...originals, ...thumbs]
}

/**
 * Write missing images to storage, one file at a time. A failure is counted and retried on the next sync; it never
 * throws for a single file. Returns the updated set of confirmed paths (save it per storage module).
 */
export async function pushImages(
  local: ImageLocal,
  store: BlobStore,
  confirmed: ReadonlySet<string>,
): Promise<{ confirmed: Set<string>; report: PushReport }> {
  const done = new Set(confirmed)
  const report: PushReport = { written: 0, pending: 0, errors: [] }
  const jobs = (await wantedFiles(local)).filter((j) => !done.has(j.path))
  const originalFailed = new Set<string>()

  for (const job of jobs) {
    const blob = job.kind === 'original' ? await local.original(job.hash) : await local.thumb(job.hash)
    if (!blob) continue // not on this device (e.g. added elsewhere, or a format without a thumbnail): nothing to push
    try {
      const there = await store.hasBlob(job.path)
      if (there) {
        if (there.size !== blob.size) throw new BlobCollisionError(job.path, there.size, blob.size)
      } else {
        await store.writeBlob(job.path, blob)
        report.written++
      }
      done.add(job.path)
    } catch (e) {
      if (job.kind === 'original') originalFailed.add(job.hash)
      report.pending++
      report.errors.push(e instanceof Error ? e.message : String(e))
    }
  }

  // An original counts as safely stored once every year copy it needs is there.
  for (const hash of new Set(jobs.filter((j) => j.kind === 'original').map((j) => j.hash))) {
    if (!originalFailed.has(hash) && (await local.original(hash))) await local.markOnRemote(hash)
  }
  return { confirmed: done, report }
}

export interface PullReport {
  fetched: number // thumbnails downloaded from storage
  rebuilt: number // thumbnails made again from an original on this device
  missing: string[] // hashes of shown-type images with no thumbnail anywhere yet (e.g. the other device hasn't synced)
  failed: number // reads/writes that failed this run (retried next sync)
  errors: string[]
}

/**
 * Runs AFTER syncOnce, so entries that just arrived from another device are included. For every image a live entry
 * uses that has no thumbnail on this device:
 * 1. download `.thumbs/<hash>.webp` from storage (small, so done eagerly);
 * 2. otherwise, if this device has the original, make the thumbnail again and write it back to storage;
 * 3. otherwise report it as missing (shown as "not synced yet"); it is tried again next sync.
 * Originals are never downloaded here; the photo viewer fetches them when opened. Formats the app can't show (HEIC,
 * AVIF) never have thumbnails and are skipped. Never deletes anything.
 */
export async function pullImages(
  local: ImageLocal,
  store: BlobStore,
  confirmed: ReadonlySet<string>,
): Promise<{ confirmed: Set<string>; report: PullReport }> {
  const done = new Set(confirmed)
  const report: PullReport = { fetched: 0, rebuilt: 0, missing: [], failed: 0, errors: [] }
  const fail = (e: unknown) => {
    report.failed++
    report.errors.push(e instanceof Error ? e.message : String(e))
  }

  const refs = new Map<string, ImageRef>()
  for (const e of await local.snapshot()) {
    if (e.deleted) continue
    for (const img of entryImages(e)) {
      const seen = refs.get(img.hash)
      if (!seen || (!seen.w && img.w)) refs.set(img.hash, img) // prefer a reference that knows the size
    }
  }

  for (const [hash, ref] of [...refs].sort(([a], [b]) => a.localeCompare(b))) {
    if (!isDisplayable(ref)) continue
    if (await local.thumb(hash)) continue
    const path = thumbPath(hash)

    let remote: Blob | null
    try {
      remote = await store.readBlob(path)
    } catch (e) {
      fail(e)
      continue
    }
    if (remote) {
      await local.saveThumb(hash, remote, ref.w, ref.h)
      done.add(path)
      report.fetched++
      continue
    }

    const original = await local.original(hash)
    const t = original ? await local.thumbnail(original) : null
    if (!t) {
      report.missing.push(hash)
      continue
    }
    await local.saveThumb(hash, t.thumb, t.w, t.h)
    report.rebuilt++
    try {
      await store.writeBlob(path, t.thumb)
      done.add(path)
    } catch (e) {
      fail(e) // the local thumbnail is kept; pushImages writes it on a later sync
    }
  }
  return { confirmed: done, report }
}
