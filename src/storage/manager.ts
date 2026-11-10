import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, evictOriginals, getMeta, saveFetchedOriginal, setMeta, touchOriginal } from '../lib/db'
import type { ImageRef } from '../lib/entry'
import { makeThumbnail } from '../lib/imageClient'
import { KeySet } from '../lib/keySet'
import { isDisplayable, typeForExt } from '../lib/images'
import { type ImageLocal, imagesWaiting } from './attachments'
import { backendById } from './backends'
import { ORIGINALS_CACHE_BYTES, fetchOriginal } from './originals'
import { emptySyncState } from './sync'
import { syncAll } from './syncAll'
import { type FileStore, type LocalStore, type SyncReport, type SyncState, supportsBlobs } from './types'

/** The real LocalStore: the Dexie database. */
export const dexieLocal: LocalStore = {
  snapshot: () => db.entries.toArray(),
  apply: (updates, base) =>
    db.transaction('rw', db.entries, async () => {
      const current = await db.entries.bulkGet(updates.map((u) => u.id))
      await db.entries.bulkPut(updates.filter((u, i) => current[i]?.updatedAt === base.get(u.id)))
    }),
}

/** The image side of the Dexie database, for the image passes. */
export const dexieImages: ImageLocal = {
  snapshot: () => db.entries.toArray(),
  original: async (hash) => (await db.blobs.get(hash))?.blob ?? null,
  thumb: async (hash) => (await db.thumbs.get(hash))?.blob ?? null,
  markOnRemote: async (hash) => { await db.blobs.update(hash, { onRemote: 1 }) },
  unsaved: () => db.blobs.where('onRemote').equals(0).primaryKeys(),
  saveThumb: async (hash, blob, w, h) => { await db.thumbs.put({ hash, blob, w, h }) },
  thumbnail: makeThumbnail,
}

interface SavedStorage {
  backendId: string
  config: unknown
}

export type StorageStatus = 'off' | 'needs-permission' | 'syncing' | 'ok' | 'error'

export interface StorageState {
  backendId: string | null
  label: string | null
  status: StorageStatus
  message: string | null
  lastSync: number | null
  lastReport: SyncReport | null
  pending: number // local changes not yet written to storage
  imagesWaiting: number // photos on this device that storage doesn't have yet (live, like `pending`)
  imagesFailed: number // photos the last run couldn't fetch from storage (retried next sync)
  imageError: string | null // last image problem; never turns the status into 'error'
}

/** Photos the badge reports as waiting: still to save from here, plus ones that failed to download. */
export const imagesPending = (s: StorageState) => s.imagesWaiting + s.imagesFailed

let state: StorageState = {
  backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null, pending: 0,
  imagesWaiting: 0, imagesFailed: 0, imageError: null,
}
const listeners = new Set<() => void>()
function set(patch: Partial<StorageState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function useStorage(): StorageState {
  return useSyncExternalStore(subscribe, () => state)
}

/**
 * Photos that the last sync found nowhere: no thumbnail in storage and no original on this device (usually the
 * device that added them hasn't synced yet). Shown as "Not synced yet". Recomputed on every sync.
 */
export const missingImages = new KeySet()

/** Whether this photo is known to be missing everywhere (re-renders only when that answer changes). */
export function useImageMissing(hash: string): boolean {
  return useSyncExternalStore(missingImages.subscribe, () => missingImages.has(hash))
}

let store: FileStore | null = null
let running: Promise<void> | null = null
let again = false
let timer: ReturnType<typeof setTimeout> | undefined
const syncKey = (id: string) => `sync:${id}`
const imagesKey = (id: string) => `images:${id}` // image paths confirmed to exist in that storage

function schedule(ms: number) {
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), ms)
}

function describe(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export function syncNow(): Promise<void> {
  if (!store || !state.backendId) return Promise.resolve()
  if (running) { again = true; return running }
  const id = state.backendId
  running = (async () => {
    do {
      again = false
      const current = store
      if (!current) break
      set({ status: 'syncing' })
      try {
        const prev = await getMeta<SyncState>(syncKey(id), emptySyncState())
        const confirmed = new Set(await getMeta<string[]>(imagesKey(id), []))
        const r = await syncAll(dexieLocal, dexieImages, current, prev, confirmed)
        await setMeta(imagesKey(id), [...r.confirmed])
        await setMeta(syncKey(id), r.state)
        set({
          status: 'ok', message: null, lastSync: Date.now(), lastReport: r.report,
          imagesFailed: r.pulled?.failed ?? 0, // failed writes stay unsaved, so imagesWaiting already counts them
          imageError: r.images?.errors[0] ?? r.pulled?.errors[0] ?? null,
        })
        missingImages.replace(r.pulled?.missing ?? [])
        await trimOriginals(id)
      } catch (e) {
        const lost = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
        set({ status: lost ? 'needs-permission' : 'error', message: describe(e) })
        if (lost) store = null
        break
      }
    } while (again)
  })().finally(() => { running = null })
  return running
}

/** Originals on screen (the photo viewer), never dropped while shown. hash -> number of holders. */
const held = new Map<string, number>()
export function holdOriginal(hash: string): () => void {
  held.set(hash, (held.get(hash) ?? 0) + 1)
  return () => {
    const n = (held.get(hash) ?? 1) - 1
    if (n > 0) held.set(hash, n)
    else held.delete(hash)
  }
}

/**
 * Keep local originals within the cache limit, but only while the active storage is a separate copy that has
 * confirmed them (never with "Files inside this browser", never without storage). Never throws.
 */
async function trimOriginals(backendId: string, keep: ReadonlySet<string> = new Set()) {
  if (!store || state.backendId !== backendId || backendById(backendId)?.insideBrowser) return
  try {
    await evictOriginals(ORIGINALS_CACHE_BYTES, new Set([...keep, ...held.keys()]))
  } catch (e) {
    console.warn('Could not trim cached photos:', e)
  }
}

export type OriginalResult =
  | { kind: 'ok'; blob: Blob }
  | { kind: 'no-storage' } // no storage connected (or it can't hold images): nowhere to get it from
  | { kind: 'not-found' } // storage doesn't have it (yet)
  | { kind: 'error'; message: string }

const loading = new Map<string, Promise<OriginalResult>>()

/**
 * The full original of a photo, for the viewer: from this device, else downloaded from storage and kept (within the
 * cache limit). Also makes a missing thumbnail from it. One download per photo at a time.
 */
export function loadOriginal(ref: Pick<ImageRef, 'hash' | 'ext'>, day: string): Promise<OriginalResult> {
  const running = loading.get(ref.hash)
  if (running) return running
  const p = (async (): Promise<OriginalResult> => {
    const local = await db.blobs.get(ref.hash)
    if (local) {
      await touchOriginal(ref.hash)
      return { kind: 'ok', blob: local.blob }
    }
    const s = store
    const id = state.backendId
    if (!s || !id || !supportsBlobs(s)) return { kind: 'no-storage' }
    try {
      let blob = await fetchOriginal(s, ref, [day.slice(0, 4)])
      if (!blob) {
        // Also stored in the year folder of any other entry that uses it.
        const others = await db.entries.filter((e) => !e.deleted && !!e.images?.some((i) => i.hash === ref.hash)).toArray()
        blob = await fetchOriginal(s, ref, others.map((e) => e.day.slice(0, 4)).filter((y) => y !== day.slice(0, 4)))
      }
      if (!blob) return { kind: 'not-found' }
      const mime = typeForExt(ref.ext)?.mime ?? 'application/octet-stream'
      const kept = await saveFetchedOriginal(ref.hash, new Blob([blob], { type: mime }), mime)
      if (isDisplayable(ref) && !(await db.thumbs.get(ref.hash))) {
        const t = await makeThumbnail(kept)
        if (t) await db.thumbs.put({ hash: ref.hash, blob: t.thumb, w: t.w, h: t.h })
      }
      await trimOriginals(id, new Set([ref.hash]))
      return { kind: 'ok', blob: kept }
    } catch (e) {
      return { kind: 'error', message: describe(e) }
    }
  })().finally(() => loading.delete(ref.hash))
  loading.set(ref.hash, p)
  return p
}

async function openSaved(saved: SavedStorage, interactive: boolean) {
  const backend = backendById(saved.backendId)
  if (!backend) return set({ status: 'error', message: `Unknown storage “${saved.backendId}”` })
  set({ backendId: backend.id })
  const r = await backend.open(saved.config as never, interactive)
  if (r.ok) {
    store = r.store
    set({ label: r.label, status: 'ok', message: null })
    await syncNow()
  } else {
    set({ label: backend.name, status: r.reason === 'needs-permission' ? 'needs-permission' : 'error', message: r.message ?? null })
  }
}

let started = false
export async function initStorage() {
  if (started) return
  started = true
  void navigator.storage?.persist?.().catch(() => false) // ask the browser not to evict our data
  liveQuery(() => db.entries.where('dirty').equals(1).count()).subscribe({
    next: (n) => {
      set({ pending: n })
      if (n && store) schedule(1500)
    },
  })
  // Cheap when everything is saved (an index count); only then looks at which entries use the unsaved photos.
  liveQuery(async () => {
    const unsaved = await dexieImages.unsaved()
    return unsaved.length ? imagesWaiting(await db.entries.toArray(), new Set(unsaved)) : 0
  }).subscribe({ next: (n) => set({ imagesWaiting: n }) })
  document.addEventListener('visibilitychange', () => void syncNow()) // flush when hidden, pull when shown
  setInterval(() => void syncNow(), 5 * 60_000) // pick up changes made by other apps
  const saved = await getMeta<SavedStorage | null>('storage', null)
  if (saved) await openSaved(saved, false)
}

/** Choose a storage module (call from a click handler). */
export async function connect(backendId: string) {
  const backend = backendById(backendId)
  if (!backend) return
  try {
    const { config, store: s, label } = await backend.setup()
    await setMeta('storage', { backendId, config } satisfies SavedStorage)
    await setMeta(syncKey(backendId), emptySyncState()) // new location: compare everything afresh
    await setMeta(imagesKey(backendId), []) // ...and check every image again
    await db.blobs.toCollection().modify({ onRemote: 0 }) // the new location doesn't have them yet
    store = s
    missingImages.replace([]) // that answer was about the old storage
    set({ backendId, label, status: 'ok', message: null, lastSync: null, lastReport: null, imagesFailed: 0, imageError: null })
    await syncNow()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return // picker cancelled
    set({ status: 'error', message: describe(e) })
  }
}

/** Re-grant access after a restart (call from a click handler). */
export async function reconnect() {
  const saved = await getMeta<SavedStorage | null>('storage', null)
  if (saved) await openSaved(saved, true)
}

export async function disconnect() {
  store = null
  clearTimeout(timer)
  missingImages.replace([])
  await db.meta.delete('storage')
  set({ backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null, imagesFailed: 0, imageError: null })
}
