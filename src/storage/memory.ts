import type { Entry } from '../lib/entry'
import { BlobCollisionError, type BlobStore, type LocalStore } from './types'

/**
 * In-memory FileStore: for tests, and a template for writing new storage modules.
 * Binary files live in their own map and are not returned by list(), like the real stores.
 */
export function memoryStore(
  initial: Record<string, string> = {},
): BlobStore & { files: Map<string, { content: string; rev: string }>; blobs: Map<string, Blob> } {
  let counter = 0
  const files = new Map<string, { content: string; rev: string }>()
  const blobs = new Map<string, Blob>()
  for (const [p, c] of Object.entries(initial)) files.set(p, { content: c, rev: `r${++counter}` })
  return {
    files,
    blobs,
    async list() { return [...files].map(([path, f]) => ({ path, rev: f.rev })) },
    async read(path) { return files.get(path)?.content ?? null },
    async write(path, content) {
      const rev = `r${++counter}`
      files.set(path, { content, rev })
      return rev
    },
    async remove(path) { files.delete(path) },
    async readBlob(path) { return blobs.get(path) ?? null },
    async hasBlob(path) {
      const b = blobs.get(path)
      return b ? { size: b.size } : null
    },
    async writeBlob(path, blob) {
      const existing = blobs.get(path)
      if (existing) {
        if (existing.size === blob.size) return
        throw new BlobCollisionError(path, existing.size, blob.size)
      }
      blobs.set(path, blob)
    },
  }
}

/** In-memory LocalStore with the same "don't overwrite newer edits" rule as the real one. */
export function memoryLocal(initial: Entry[] = []): LocalStore & { entries: Map<string, Entry> } {
  const entries = new Map(initial.map((e) => [e.id, e]))
  return {
    entries,
    async snapshot() { return [...entries.values()] },
    async apply(updates, base) {
      for (const u of updates) if (entries.get(u.id)?.updatedAt === base.get(u.id)) entries.set(u.id, u)
    },
  }
}
