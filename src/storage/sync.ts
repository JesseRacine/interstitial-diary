import type { Entry } from '../lib/entry'
import { dayFilePath, parseDay, serializeDay } from '../lib/markdown'
import { merge, type Tombstones } from '../lib/merge'
import type { FileStore, LocalStore, SyncReport, SyncState } from './types'

/*
 * Backend-agnostic two-way sync between the local database and a FileStore.
 *
 * 1. Pull: read every day file whose rev changed since the last sync, plus the tombstones file.
 * 2. Merge with local entries by id (newest updatedAt wins, deletions via tombstones).
 * 3. Push: rewrite day files that have local changes, that changed after merging, or that are
 *    missing remotely (e.g. a brand-new, empty folder). Remove files for days with no entries left.
 * 4. Save merged entries locally and clear their dirty flags.
 *
 * If anything throws, nothing is marked synced, so the next run simply retries.
 */

export const TOMBSTONES_PATH = '.meta/tombstones.json'
const DAY_PATH_RE = /^(\d{4})\/((\d{4})-\d{2}-\d{2})\.md$/

export function dayFromPath(path: string): string | null {
  const m = path.match(DAY_PATH_RE)
  return m && m[1] === m[3] ? m[2] : null
}

export const emptySyncState = (): SyncState => ({ revs: {} })

const sameVersion = (a: Entry, b: Entry) => a.updatedAt === b.updatedAt && a.deleted === b.deleted && a.text === b.text

function stableJson(t: Tombstones): string {
  const sorted: Tombstones = {}
  for (const k of Object.keys(t).sort()) sorted[k] = t[k]
  return `${JSON.stringify(sorted, null, 1)}\n`
}

export async function syncOnce(local: LocalStore, store: FileStore, prev: SyncState): Promise<{ state: SyncState; report: SyncReport }> {
  const report: SyncReport = { read: 0, written: 0, removed: 0, updatedLocally: 0 }
  const files = await store.list()
  const remote = new Map(files.map((f) => [f.path, f.rev]))
  const revs: Record<string, string> = {}

  const snapshot = await local.snapshot()
  const base = new Map(snapshot.map((e) => [e.id, e.updatedAt]))
  const localById = new Map(snapshot.map((e) => [e.id, e]))

  // 1. Pull
  let tombText: string | null = null
  let remoteTombs: Tombstones = {}
  if (remote.has(TOMBSTONES_PATH)) {
    tombText = await store.read(TOMBSTONES_PATH)
    report.read++
    try { remoteTombs = JSON.parse(tombText ?? '{}') as Tombstones } catch { remoteTombs = {} }
  }

  const pulled = new Map<string, string>() // day -> file text as read
  const remoteEntries: Entry[] = []
  for (const [path, rev] of remote) {
    const day = dayFromPath(path)
    if (!day) continue
    revs[path] = rev
    if (prev.revs[path] === rev) continue // unchanged since last sync: local copy is already up to date
    const text = await store.read(path)
    report.read++
    if (text === null) { delete revs[path]; continue }
    pulled.set(day, text)
    remoteEntries.push(...parseDay(text, day))
  }

  // 2. Merge
  const { entries: merged, tombstones } = merge(snapshot, remoteEntries, remoteTombs)

  // 3. Push
  const liveByDay = new Map<string, Entry[]>()
  for (const e of merged) {
    if (e.deleted) continue
    const list = liveByDay.get(e.day)
    if (list) list.push(e)
    else liveByDay.set(e.day, [e])
  }
  const days = new Set<string>(pulled.keys())
  for (const e of snapshot) if (e.dirty) days.add(e.day)
  for (const d of liveByDay.keys()) if (!remote.has(dayFilePath(d))) days.add(d)

  for (const day of [...days].sort()) {
    const path = dayFilePath(day)
    const live = liveByDay.get(day) ?? []
    if (!live.length) {
      if (remote.has(path)) {
        await store.remove(path)
        delete revs[path]
        report.removed++
      }
      continue
    }
    const content = serializeDay(day, live)
    if (pulled.get(day) === content) continue
    revs[path] = await store.write(path, content)
    report.written++
  }

  const newTombText = stableJson(tombstones)
  if (Object.keys(tombstones).length && newTombText !== tombText) {
    await store.write(TOMBSTONES_PATH, newTombText)
    report.written++
  }

  // 4. Save locally
  const updates: Entry[] = []
  for (const e of merged) {
    const l = localById.get(e.id)
    const changed = !l || !sameVersion(l, e)
    if (changed) report.updatedLocally++
    if (changed || l.dirty) updates.push({ ...e, dirty: 0 })
  }
  if (updates.length) await local.apply(updates, base)

  return { state: { revs }, report }
}
