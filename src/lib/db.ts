import Dexie, { type Table } from 'dexie'
import { type Entry, makeEntry, replaceTag, withDerived } from './entry'

export interface Meta {
  key: string
  value: unknown
}

class DiaryDB extends Dexie {
  entries!: Table<Entry, string>
  meta!: Table<Meta, string>

  constructor() {
    super('interstitial-diary')
    this.version(1).stores({
      entries: 'id, createdAt, day, *tags, dirty',
      meta: 'key',
    })
  }
}

export const db = new DiaryDB()

const nextStamp = (prev: number) => Math.max(Date.now(), prev + 1)

export async function addEntry(text: string): Promise<Entry | null> {
  const t = text.trim()
  if (!t) return null
  const e = makeEntry(t)
  await db.entries.add(e)
  return e
}

export async function updateEntryText(id: string, text: string): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.put(withDerived({ ...e, text: text.trim(), updatedAt: nextStamp(e.updatedAt), dirty: 1 }))
}

/** Soft delete: kept as a tombstone so the deletion can sync to other devices. */
export async function deleteEntry(id: string): Promise<void> {
  const e = await db.entries.get(id)
  if (!e) return
  await db.entries.put({ ...e, deleted: 1, updatedAt: nextStamp(e.updatedAt), dirty: 1 })
}

/** Rename (or merge into an existing) tag across all entries. Returns how many entries changed. */
export async function renameTag(from: string, to: string): Promise<number> {
  const affected = (await db.entries.where('tags').equals(from).toArray()).filter((e) => !e.deleted)
  const updated = affected.map((e) =>
    withDerived({ ...e, text: replaceTag(e.text, from, to), updatedAt: nextStamp(e.updatedAt), dirty: 1 }),
  )
  await db.entries.bulkPut(updated)
  return updated.length
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const m = await db.meta.get(key)
  return (m?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
