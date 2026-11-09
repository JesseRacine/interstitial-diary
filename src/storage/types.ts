import type { Entry } from '../lib/entry'

/*
 * Storage is modular. A storage module (local folder, browser files, pCloud, GitHub, ...)
 * only has to move files around; it knows nothing about entries or merging.
 * The shared sync engine (sync.ts) does the rest, so every module behaves the same.
 */

export interface StoredFile {
  path: string // relative, '/'-separated, e.g. "2026/2026-11-08.md"
  rev: string // changes whenever the file's content changes (mtime+size, hash, etag...)
}

export interface FileStore {
  list(): Promise<StoredFile[]> // every file under the root, recursively
  read(path: string): Promise<string | null> // null if missing
  write(path: string, content: string): Promise<string> // creates folders as needed; returns the new rev
  remove(path: string): Promise<void>
}

/** Result of opening a module from its saved config. */
export type OpenResult = { ok: true; store: FileStore; label: string } | { ok: false; reason: 'needs-permission' | 'unavailable'; message?: string }

/** Describes one storage module. Register new ones in backends/index.ts. */
export interface StorageBackend<Config = unknown> {
  id: string
  name: string
  description: string
  /** null if usable here, otherwise a short reason why not. */
  unsupportedReason(): string | null
  /** Interactive first-time setup (runs inside a click handler). */
  setup(): Promise<{ config: Config; store: FileStore; label: string }>
  /** Reopen from saved config. With interactive=true it may prompt (e.g. re-grant folder access). */
  open(config: Config, interactive: boolean): Promise<OpenResult>
}

/** What the sync engine needs from the local database. */
export interface LocalStore {
  snapshot(): Promise<Entry[]> // all entries, including deleted ones
  /**
   * Save the given entries, but skip any whose local copy changed since the snapshot
   * (its updatedAt no longer matches `base`), so edits made mid-sync are never overwritten.
   */
  apply(updates: Entry[], base: Map<string, number>): Promise<void>
}

export interface SyncState {
  revs: Record<string, string> // path -> rev as of the last successful sync
}

export interface SyncReport {
  read: number
  written: number
  removed: number
  updatedLocally: number
}
