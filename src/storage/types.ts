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
  list(): Promise<StoredFile[]> // the diary's text files (day files + tombstones), recursively; never images
  read(path: string): Promise<string | null> // null if missing
  write(path: string, content: string): Promise<string> // creates folders as needed; returns the new rev
  remove(path: string): Promise<void>

  /*
   * Binary files (images). Optional: a module without them simply doesn't sync images.
   * Image files are named by their content and never change, so writeBlob never overwrites: if the file exists with
   * the same size it does nothing; with a different size it throws BlobCollisionError and leaves the file alone.
   */
  readBlob?(path: string): Promise<Blob | null>
  writeBlob?(path: string, blob: Blob): Promise<void>
  hasBlob?(path: string): Promise<{ size: number } | null>
  /**
   * Delete one image file; a missing file is not an error. Only ever called by the user-confirmed "remove photos of
   * deleted entries" cleanup (storage/cleanup.ts), never by sync. Optional: without it the cleanup leaves storage alone.
   */
  removeBlob?(path: string): Promise<void>
}

export type BlobStore = FileStore & Required<Pick<FileStore, 'readBlob' | 'writeBlob' | 'hasBlob'>>

export const supportsBlobs = (s: FileStore): s is BlobStore => !!(s.readBlob && s.writeBlob && s.hasBlob)

export type RemovableBlobStore = BlobStore & Required<Pick<FileStore, 'removeBlob'>>
export const supportsBlobRemoval = (s: FileStore): s is RemovableBlobStore => supportsBlobs(s) && !!s.removeBlob

export class BlobCollisionError extends Error {
  constructor(path: string, existing: number, incoming: number) {
    super(`${path} already exists with different content (${existing} bytes, new file ${incoming} bytes); left as it was`)
    this.name = 'BlobCollisionError'
  }
}

/** Result of opening a module from its saved config. */
export type OpenResult = { ok: true; store: FileStore; label: string } | { ok: false; reason: 'needs-permission' | 'unavailable'; message?: string }

/** Describes one storage module. Register new ones in backends/index.ts. */
export interface StorageBackend<Config = unknown> {
  id: string
  name: string
  description: string
  /**
   * True when its files live in the same browser storage as the app's database, so they are not a separate copy.
   * Then photos are never dropped from this device to save space.
   */
  insideBrowser?: boolean
  /** null if usable here, otherwise a short reason why not. */
  unsupportedReason(): string | null
  /**
   * Interactive first-time setup (runs inside a click handler). A module that signs in on another site (OAuth) sends
   * the browser there instead and never resolves; the setup is then finished by `resumeSetup` when the page loads again.
   */
  setup(): Promise<{ config: Config; store: FileStore; label: string }>
  /**
   * Only for modules whose setup leaves the page: finish it from the URL the sign-in site sent the browser back to.
   * Called at startup (see storage/resume.ts) only when a sign-in for this module was started.
   */
  resumeSetup?(href: string): Promise<{ config: Config; store: FileStore; label: string }>
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
