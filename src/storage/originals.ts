import type { ImageRef } from '../lib/entry'
import { hashBytes, imagePath } from '../lib/images'
import type { BlobStore } from './types'

/*
 * Full-size originals on devices that didn't add them. Backend-agnostic, like attachments.ts.
 * - Sync never downloads originals; the photo viewer asks for one when it is opened (fetchOriginal).
 * - Originals kept on this device form a bounded cache (chooseEvictions). The rule: a local original may be dropped
 *   only when storage has confirmed it (onRemote 1), a storage module is active, and that module is a separate copy
 *   (not "Files inside this browser", which lives in the same browser storage). The caller checks the last two.
 */

/** The default for how much space local originals may take before the least recently used safe ones are dropped. */
export const ORIGINALS_CACHE_BYTES = 1024 * 1024 * 1024

const MB = 1024 * 1024
/** What Settings offers. `bytes: 0` means no limit. The saved setting must be one of these (see `normaliseLimit`). */
export const ORIGINALS_LIMIT_CHOICES: { bytes: number; label: string }[] = [
  { bytes: 256 * MB, label: '256 MB' },
  { bytes: 512 * MB, label: '512 MB' },
  { bytes: 1024 * MB, label: '1 GB' },
  { bytes: 2048 * MB, label: '2 GB' },
  { bytes: 5 * 1024 * MB, label: '5 GB' },
  { bytes: 10 * 1024 * MB, label: '10 GB' },
  { bytes: 0, label: 'No limit' },
]

/** A saved limit setting, or the default if it is missing or isn't one of the choices (so a bad value can't drop photos). */
export function normaliseLimit(v: unknown): number {
  return ORIGINALS_LIMIT_CHOICES.some((c) => c.bytes === v) ? (v as number) : ORIGINALS_CACHE_BYTES
}

/** The setting as a byte limit for `chooseEvictions`: 0 (no limit) becomes Infinity, which never drops anything. */
export const limitBytes = (setting: number): number => (setting === 0 ? Infinity : setting)

export type LimitMode =
  | 'applies' // storage holds its own copy: confirmed originals over the limit are dropped
  | 'no-storage' // nothing connected: no safe copy, so nothing is ever dropped
  | 'inside-browser' // "Files inside this browser" lives in the same browser data, so it isn't a separate copy
  | 'paused' // storage needs permission again; trimming waits for it

/**
 * Whether the limit does anything right now. Mirrors the rule trimOriginals enforces in manager.ts: only with an active
 * storage that is a separate copy and is reachable.
 */
export function limitMode(backendId: string | null, insideBrowser: boolean, needsPermission: boolean): LimitMode {
  if (!backendId) return 'no-storage'
  if (insideBrowser) return 'inside-browser'
  return needsPermission ? 'paused' : 'applies'
}

/**
 * Downloads an original from storage, trying each year folder given (the entry's own year first). The bytes must hash
 * to the file's name, so a file changed or replaced by hand is never taken for the photo. Returns null when no folder
 * has it yet; throws when only mismatching files were found, or a read failed.
 */
export async function fetchOriginal(
  store: BlobStore,
  ref: Pick<ImageRef, 'hash' | 'ext'>,
  years: string[],
): Promise<Blob | null> {
  let problem: Error | null = null
  for (const y of [...new Set(years)]) {
    const path = imagePath(`${y}-01-01`, ref)
    let blob: Blob | null
    try {
      blob = await store.readBlob(path)
    } catch (e) {
      problem = e instanceof Error ? e : new Error(String(e))
      continue
    }
    if (!blob) continue
    if ((await hashBytes(await blob.arrayBuffer())) !== ref.hash) {
      problem = new Error(`${path} doesn't match its name (it may have been changed by hand), so it wasn't used`)
      continue
    }
    return blob
  }
  if (problem) throw problem
  return null
}

export interface CachedOriginal {
  hash: string
  size: number
  onRemote: 0 | 1
  addedAt: number
  usedAt?: number
}

/**
 * Which local originals to drop so the total fits in `limit`: only ones storage has confirmed, least recently used
 * first, never one in `keep` (e.g. the photo on screen). If the safe ones aren't enough, it drops what it can.
 */
export function chooseEvictions(rows: CachedOriginal[], limit: number, keep: ReadonlySet<string> = new Set()): string[] {
  let total = rows.reduce((n, r) => n + r.size, 0)
  if (total <= limit) return []
  const candidates = rows
    .filter((r) => r.onRemote === 1 && !keep.has(r.hash))
    .sort((a, b) => (a.usedAt ?? a.addedAt) - (b.usedAt ?? b.addedAt) || a.hash.localeCompare(b.hash))
  const out: string[] = []
  for (const r of candidates) {
    if (total <= limit) break
    out.push(r.hash)
    total -= r.size
  }
  return out
}
