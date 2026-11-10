import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate'
import { type Entry, entryImages } from './entry'
import { imagePath } from './images'
import { dayFilePath, serializeDay } from './markdown'

/*
 * Export with photos: one zip with the day files AND the originals, in the same layout as the storage folder
 * (InterstitialDiary/<year>/<day>.md, InterstitialDiary/<year>/images/<hash>.<ext>; no .thumbs/).
 * Streamed with fflate's Zip, photos stored without compression (JPEGs don't shrink), so gigabytes of photos never
 * sit in memory at once when the sink writes to disk.
 */

export const ROOT = 'InterstitialDiary'
/** fflate writes plain (non-ZIP64) zips, which hold at most 4 GiB; keep a margin for headers and day files. */
export const MAX_ZIP_BYTES = 4 * 1024 ** 3 - 64 * 1024 ** 2

export interface PhotoFile {
  path: string // inside the zip
  hash: string
  size: number
}

export interface ExportPlan {
  days: string[]
  photos: PhotoFile[]
  photoBytes: number
  missing: number // photos referenced by entries but not on this device (left out)
  years: string[] // years that have entries, for exporting one year at a time
}

/**
 * What goes into the zip. `sizes` holds the originals this device has (hash -> bytes).
 * With `year`, only that year's day files and photos.
 */
export function planExport(entries: Entry[], sizes: ReadonlyMap<string, number>, year?: string): ExportPlan {
  const live = entries.filter((e) => !e.deleted)
  const years = [...new Set(live.map((e) => e.day.slice(0, 4)))].sort()
  const chosen = year ? live.filter((e) => e.day.startsWith(year)) : live
  const days = [...new Set(chosen.map((e) => e.day))].sort()
  const photos = new Map<string, PhotoFile>()
  const missing = new Set<string>()
  for (const e of chosen) {
    for (const img of entryImages(e)) {
      const size = sizes.get(img.hash)
      if (size === undefined) { missing.add(img.hash); continue }
      const path = `${ROOT}/${imagePath(e.day, img)}`
      if (!photos.has(path)) photos.set(path, { path, hash: img.hash, size })
    }
  }
  const list = [...photos.values()].sort((a, b) => a.path.localeCompare(b.path))
  return { days, photos: list, photoBytes: list.reduce((n, p) => n + p.size, 0), missing: missing.size, years }
}

/** Where the zip's bytes go: a file on disk (streamed) or memory (a Blob at the end). */
export interface ZipSink {
  write(chunk: Uint8Array): Promise<void>
  close(): Promise<void>
  abort(): Promise<void>
}

/**
 * Write the zip described by `plan` to `sink`. Reads each original through `getBlob` one at a time.
 * Calls `onProgress(done, total)` in bytes of photo data.
 */
export async function writeExportZip(
  entries: Entry[],
  plan: ExportPlan,
  getBlob: (hash: string) => Promise<Blob | null>,
  sink: ZipSink,
  onProgress: (done: number, total: number) => void = () => {},
): Promise<{ photos: number; skipped: number }> {
  // fflate calls back synchronously; queue its output and drain it into the (async) sink between pushes.
  const queue: Uint8Array[] = []
  let failed: Error | null = null
  let finished = false
  const zip = new Zip((err, chunk, final) => {
    if (err) failed = err
    else {
      queue.push(chunk)
      if (final) finished = true
    }
  })
  const drain = async () => {
    if (failed) throw failed
    while (queue.length) await sink.write(queue.shift()!)
  }

  try {
    for (const day of plan.days) {
      const f = new ZipDeflate(`${ROOT}/${dayFilePath(day)}`, { level: 6 })
      zip.add(f)
      f.push(strToU8(serializeDay(day, entries)), true)
      await drain()
    }
    let done = 0
    let photos = 0
    let skipped = 0
    for (const p of plan.photos) {
      const blob = await getBlob(p.hash)
      if (!blob) { skipped++; continue }
      const f = new ZipPassThrough(p.path) // stored, not compressed
      zip.add(f)
      const reader = blob.stream().getReader()
      for (;;) {
        const { value, done: end } = await reader.read()
        if (end) break
        f.push(value, false)
        done += value.byteLength
        await drain()
        onProgress(done, plan.photoBytes)
      }
      f.push(new Uint8Array(0), true)
      await drain()
      photos++
    }
    zip.end()
    await drain()
    if (!finished) throw new Error('The zip was not finished')
    await sink.close()
    return { photos, skipped }
  } catch (e) {
    zip.terminate()
    await sink.abort().catch(() => {})
    throw e
  }
}

/** A sink that keeps the parts in memory and hands back one Blob (browsers can page large Blobs to disk). */
export function blobSink(): ZipSink & { result: () => Blob } {
  let parts: BlobPart[] = []
  let out: Blob | null = null
  return {
    async write(chunk) { parts.push(chunk as BlobPart) },
    async close() { out = new Blob(parts, { type: 'application/zip' }); parts = [] },
    async abort() { parts = [] },
    result() {
      if (!out) throw new Error('The zip was not finished')
      return out
    },
  }
}
