import type { Entry } from '../lib/entry'
import type { FileStore, LocalStore } from './types'

/** In-memory FileStore: for tests, and a template for writing new storage modules. */
export function memoryStore(initial: Record<string, string> = {}): FileStore & { files: Map<string, { content: string; rev: string }> } {
  let counter = 0
  const files = new Map<string, { content: string; rev: string }>()
  for (const [p, c] of Object.entries(initial)) files.set(p, { content: c, rev: `r${++counter}` })
  return {
    files,
    async list() { return [...files].map(([path, f]) => ({ path, rev: f.rev })) },
    async read(path) { return files.get(path)?.content ?? null },
    async write(path, content) {
      const rev = `r${++counter}`
      files.set(path, { content, rev })
      return rev
    },
    async remove(path) { files.delete(path) },
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
