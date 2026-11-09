import { liveQuery } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db, getMeta, setMeta } from '../lib/db'
import { backendById } from './backends'
import { emptySyncState, syncOnce } from './sync'
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
}

let state: StorageState = { backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null, pending: 0 }
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
        const { state: next, report } = await syncOnce(dexieLocal, current, prev)
        await setMeta(syncKey(id), next)
        set({ status: 'ok', message: null, lastSync: Date.now(), lastReport: report })
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
    store = s
    set({ backendId, label, status: 'ok', message: null, lastSync: null, lastReport: null })
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
  set({ backendId: null, label: null, status: 'off', message: null, lastSync: null, lastReport: null })
}
