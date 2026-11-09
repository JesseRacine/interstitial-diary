import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, getMeta, setMeta } from '../lib/db'
import type { ImageLocal } from './attachments'
import { backendById } from './backends'
import { emptySyncState } from './sync'
import { syncAll } from './syncAll'
import type { FileStore, LocalStore, SyncReport, SyncState } from './types'

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
  imagesPending: number // image files that failed to write in the last run (retried next sync)
  imageError: string | null // last image problem; never turns the status into 'error'
}

let state: StorageState = {
  backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null, pending: 0,
  imagesPending: 0, imageError: null,
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
          imagesPending: r.images?.pending ?? 0,
          imageError: r.images?.errors[0] ?? null,
        })
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
    set({ backendId, label, status: 'ok', message: null, lastSync: null, lastReport: null, imagesPending: 0, imageError: null })
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
  await db.meta.delete('storage')
  set({ backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null, imagesPending: 0, imageError: null })
}
