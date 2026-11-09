import { describe, expect, it } from 'vitest'
import { type Entry, makeEntry } from '../lib/entry'
import { memoryLocal, memoryStore } from './memory'
import { dayFromPath, emptySyncState, syncOnce, TOMBSTONES_PATH } from './sync'
import type { FileStore, SyncState } from './types'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()

/** A simulated device: its own local database and its own sync state. */
function device(initial: Entry[] = []) {
  const local = memoryLocal(initial)
  let state: SyncState = emptySyncState()
  return {
    local,
    async sync(store: FileStore) {
      const r = await syncOnce(local, store, state)
      state = r.state
      return r.report
    },
    live: () => [...local.entries.values()].filter((e) => !e.deleted).map((e) => e.text).sort(),
    add(text: string, ts: number, id: string) { local.entries.set(id, makeEntry(text, ts, id)) },
    edit(id: string, text: string, ts: number) {
      const e = local.entries.get(id)!
      local.entries.set(id, { ...makeEntry(text, e.createdAt, id), updatedAt: ts })
    },
    remove(id: string, ts: number) {
      const e = local.entries.get(id)!
      local.entries.set(id, { ...e, deleted: 1, dirty: 1, updatedAt: ts })
    },
  }
}

describe('dayFromPath', () => {
  it('accepts only well-formed day files', () => {
    expect(dayFromPath('2026/2026-11-08.md')).toBe('2026-11-08')
    expect(dayFromPath('2025/2026-11-08.md')).toBeNull()
    expect(dayFromPath('notes.md')).toBeNull()
  })
})

describe('syncOnce', () => {
  it('first sync writes one file per day; a second sync does nothing', async () => {
    const store = memoryStore()
    const a = device([makeEntry('one', at(7, 9), 'a1'), makeEntry('two', at(8, 9), 'a2'), makeEntry('three', at(8, 10), 'a3')])
    const r1 = await a.sync(store)
    expect([...store.files.keys()].sort()).toEqual(['2026/2026-11-07.md', '2026/2026-11-08.md'])
    expect(r1.written).toBe(2)
    expect([...a.local.entries.values()].every((e) => e.dirty === 0)).toBe(true)
    const r2 = await a.sync(store)
    expect(r2).toEqual({ read: 0, written: 0, removed: 0, updatedLocally: 0 })
  })

  it('a new, empty storage gets everything even when nothing is dirty', async () => {
    const a = device([{ ...makeEntry('old', at(1, 9), 'x'), dirty: 0 }])
    const store = memoryStore()
    await a.sync(store)
    expect(store.files.has('2026/2026-11-01.md')).toBe(true)
  })

  it('two devices sharing storage see each other’s entries, including offline edits', async () => {
    const store = memoryStore()
    const a = device()
    const b = device()
    a.add('from windows', at(8, 9), 'w1')
    await a.sync(store)
    await b.sync(store)
    expect(b.live()).toEqual(['from windows'])

    a.add('windows offline', at(8, 10), 'w2')
    b.add('android offline', at(8, 10, 5), 'p1')
    await a.sync(store)
    await b.sync(store)
    await a.sync(store)
    expect(a.live()).toEqual(['android offline', 'from windows', 'windows offline'])
    expect(b.live()).toEqual(a.live())
  })

  it('edits and deletions propagate; an emptied day file is removed', async () => {
    const store = memoryStore()
    const a = device()
    const b = device()
    a.add('draft', at(8, 9), 'e1')
    a.add('other day', at(9, 9), 'e2')
    await a.sync(store)
    await b.sync(store)

    b.edit('e1', 'final', at(8, 12))
    await b.sync(store)
    await a.sync(store)
    expect(a.live()).toEqual(['final', 'other day'])

    a.remove('e2', at(9, 12))
    await a.sync(store)
    expect(store.files.has('2026/2026-11-09.md')).toBe(false)
    expect(JSON.parse(store.files.get(TOMBSTONES_PATH)!.content)).toEqual({ e2: at(9, 12) })
    await b.sync(store)
    expect(b.live()).toEqual(['final'])
  })

  it('picks up entries typed into the files by hand and gives them ids', async () => {
    const store = memoryStore({ '2026/2026-11-08.md': '# Sunday\n\n## 14:30\nWritten in a text editor #manual\n' })
    const a = device()
    const r = await a.sync(store)
    expect(r.updatedLocally).toBe(1)
    expect(a.live()).toEqual(['Written in a text editor #manual'])
    expect(store.files.get('2026/2026-11-08.md')!.content).toMatch(/## 14:30 <!-- id:\S+ created:\d+ updated:\d+ -->/)
    // and syncing again doesn't duplicate it
    await a.sync(store)
    await a.sync(store)
    expect(a.live()).toHaveLength(1)
  })

  it('ignores unrelated files in the folder', async () => {
    const store = memoryStore({ 'README.md': 'hello', '2026/notes.txt': 'x' })
    const a = device([makeEntry('one', at(8, 9), 'a1')])
    await a.sync(store)
    expect(store.files.get('README.md')!.content).toBe('hello')
    expect(a.live()).toEqual(['one'])
  })

  it('never overwrites an edit made while a sync was running', async () => {
    const store = memoryStore()
    const a = device([makeEntry('v1', at(8, 9), 'x')])
    const realWrite = store.write.bind(store)
    store.write = async (path, content) => {
      a.edit('x', 'v2 typed during sync', at(8, 9, 30)) // user edits while files are being written
      return realWrite(path, content)
    }
    await a.sync(store)
    const x = a.local.entries.get('x')!
    expect(x.text).toBe('v2 typed during sync')
    expect(x.dirty).toBe(1) // still pending, goes out next sync
    store.write = realWrite
    await a.sync(store)
    expect(store.files.get('2026/2026-11-08.md')!.content).toContain('v2 typed during sync')
  })

  it('a failed write leaves changes pending for the next attempt', async () => {
    const store = memoryStore()
    const a = device([makeEntry('one', at(8, 9), 'a1')])
    const realWrite = store.write.bind(store)
    store.write = async () => { throw new Error('disk full') }
    await expect(a.sync(store)).rejects.toThrow('disk full')
    expect(a.local.entries.get('a1')!.dirty).toBe(1)
    store.write = realWrite
    await a.sync(store)
    expect(store.files.size).toBe(1)
  })
})
