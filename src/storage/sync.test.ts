import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from '../lib/entry'
import { retimeEntry } from '../lib/retime'
import { memoryLocal, memoryStore } from './memory'
import { dayFromPath, emptySyncState, sameVersion, syncOnce, TOMBSTONES_PATH } from './sync'
import type { FileStore, SyncState } from './types'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
/** An edit stamp later than every entry's creation, so it wins a merge the way a real edit does. */
const S = (n: number) => at(20, 0) + n

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
    /** Give an entry another time, the way the editor does (retimeEntry). */
    move(id: string, createdAt: number, stamp: number) {
      local.entries.set(id, retimeEntry(local.entries.get(id)!, createdAt, stamp))
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

  it('accepts edits made to existing entries directly in the file', async () => {
    const store = memoryStore()
    const a = device([makeEntry('original text #old', at(8, 9), 'x')])
    await a.sync(store)
    const path = '2026/2026-11-08.md'
    await store.write(path, store.files.get(path)!.content.replace('original text #old', 'edited in Notepad\nsecond line #new'))
    const r = await a.sync(store)
    const x = a.local.entries.get('x')!
    expect(x.text).toBe('edited in Notepad\nsecond line #new')
    expect(x.tags).toEqual(['new'])
    expect(x.updatedAt).toBeGreaterThan(at(8, 9))
    expect(r.updatedLocally).toBe(1)
    // the file keeps the edit and records the new stamp, so other devices take it too
    expect(store.files.get(path)!.content).toContain('edited in Notepad')
    expect(store.files.get(path)!.content).toContain(`updated:${x.updatedAt}`)
    const b = device()
    await b.sync(store)
    expect(b.live()).toEqual(['edited in Notepad\nsecond line #new'])
  })

  it('an edit made in the app after the file was last written still wins over the old file', async () => {
    const store = memoryStore()
    const a = device([makeEntry('v1', at(8, 9), 'x')])
    const b = device()
    await a.sync(store)
    await b.sync(store)
    a.edit('x', 'v2 from app', at(8, 10))
    await a.sync(store)
    await b.sync(store) // b's local is v1 with the old stamp; the file has v2 with a newer stamp
    expect(b.live()).toEqual(['v2 from app'])
  })

  it('removing an entry by hand is not treated as a deletion', async () => {
    const store = memoryStore()
    const a = device([makeEntry('keep me', at(8, 9), 'x'), makeEntry('other', at(8, 10), 'y')])
    await a.sync(store)
    const path = '2026/2026-11-08.md'
    const content = store.files.get(path)!.content
    await store.write(path, content.slice(0, content.indexOf('## 09:00')))
    await a.sync(store)
    expect(a.live()).toEqual(['keep me', 'other'])
    expect(store.files.get(path)!.content).toContain('keep me')
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

  describe('images edited by hand', () => {
    const A: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
    const B: ImageRef = { hash: '9c01aa22f3b6d710', ext: 'png', w: 800, h: 600 }
    const path = '2026/2026-11-08.md'

    it('an image line removed by hand wins and is not written back', async () => {
      const store = memoryStore()
      const a = device([makeEntry('two photos', at(8, 9), 'x', [A, B])])
      await a.sync(store)
      const content = store.files.get(path)!.content
      await store.write(path, content.replace('![800x600](images/9c01aa22f3b6d710.png)\n', ''))
      const r = await a.sync(store)
      const x = a.local.entries.get('x')!
      expect(x.images).toEqual([A])
      expect(x.updatedAt).toBeGreaterThan(at(8, 9))
      expect(r.updatedLocally).toBe(1)
      expect(store.files.get(path)!.content).not.toContain('9c01aa22f3b6d710')
      // another device takes the edit too
      const b = device()
      await b.sync(store)
      expect(b.local.entries.get('x')!.images).toEqual([A])
    })

    it('an image line added by hand (text unchanged) counts as a change', async () => {
      const store = memoryStore()
      const a = device([makeEntry('no photos yet', at(8, 9), 'x')])
      await a.sync(store)
      const content = store.files.get(path)!.content
      await store.write(path, content.replace('no photos yet\n', 'no photos yet\n\n![640x480](images/3f9a2c1b7d04e8aa.jpg)\n'))
      const r = await a.sync(store)
      expect(r.updatedLocally).toBe(1)
      expect(a.local.entries.get('x')!.images).toEqual([A])
      expect(a.local.entries.get('x')!.text).toBe('no photos yet')
    })

    it('images sync between devices, and an unchanged entry stays quiet', async () => {
      const store = memoryStore()
      const a = device([makeEntry('photo', at(8, 9), 'x', [A])])
      const b = device()
      await a.sync(store)
      await b.sync(store)
      expect(b.local.entries.get('x')!.images).toEqual([A])
      expect(await a.sync(store)).toEqual({ read: 0, written: 0, removed: 0, updatedLocally: 0 })
    })

    it('sameVersion compares images', () => {
      const e = makeEntry('same', at(8, 9), 'x', [A])
      expect(sameVersion(e, { ...e })).toBe(true)
      expect(sameVersion(e, { ...e, images: [B] })).toBe(false)
      expect(sameVersion(e, { ...e, images: undefined })).toBe(false)
      expect(sameVersion({ ...e, images: undefined }, { ...e, images: [] })).toBe(true)
    })
  })

  describe('an entry given another time', () => {
    const NEW_DAY = '2026/2026-11-09.md'
    const OLD_DAY = '2026/2026-11-08.md'

    it('moves to the new day’s file and leaves the old day’s file without it', async () => {
      const store = memoryStore()
      const a = device()
      a.add('stays', at(8, 9), 'e2')
      a.add('moves', at(8, 10), 'e1')
      await a.sync(store)

      a.move('e1', at(9, 7), S(1))
      const r = await a.sync(store)
      expect(store.files.get(NEW_DAY)!.content).toContain('id:e1')
      expect(store.files.get(OLD_DAY)!.content).not.toContain('id:e1')
      expect(store.files.get(OLD_DAY)!.content).toContain('id:e2')
      expect(r.written).toBe(2)
      expect('prevDay' in a.local.entries.get('e1')!).toBe(false) // done: cleared once synced
      expect(await a.sync(store)).toEqual({ read: 0, written: 0, removed: 0, updatedLocally: 0 })
    })

    it('removes the old day’s file when it was the only entry there', async () => {
      const store = memoryStore()
      const a = device()
      a.add('only one', at(8, 10), 'e1')
      await a.sync(store)
      a.move('e1', at(9, 7), S(1))
      const r = await a.sync(store)
      expect([...store.files.keys()].sort()).toEqual([NEW_DAY])
      expect(r.removed).toBe(1)
    })

    it('another device that had the old copy follows it to the new day', async () => {
      const store = memoryStore()
      const a = device()
      const b = device()
      a.add('moves', at(8, 10), 'e1')
      await a.sync(store)
      await b.sync(store)

      a.move('e1', at(9, 7), S(1))
      await a.sync(store)
      const filesAfterA = new Map([...store.files].map(([p, f]) => [p, f.content]))
      await b.sync(store)
      expect(b.local.entries.get('e1')!.day).toBe('2026-11-09')
      expect(b.local.entries.get('e1')!.createdAt).toBe(at(9, 7))
      expect(b.live()).toEqual(['moves'])
      // B's sync changed nothing in the files, and A learns nothing new either.
      expect(new Map([...store.files].map(([p, f]) => [p, f.content]))).toEqual(filesAfterA)
      await a.sync(store)
      expect(a.live()).toEqual(['moves'])
    })

    it('moved twice before a sync still clears the day that last reached a file, and moved back is fine', async () => {
      const store = memoryStore()
      const a = device()
      a.add('moves', at(8, 10), 'e1')
      a.add('stays', at(8, 11), 'e2')
      await a.sync(store)

      a.move('e1', at(9, 7), S(1))
      a.move('e1', at(10, 7), S(2))
      await a.sync(store)
      expect(store.files.get(OLD_DAY)!.content).not.toContain('id:e1')
      expect(store.files.has(NEW_DAY)).toBe(false) // never reached a file: no stray day
      expect(store.files.get('2026/2026-11-10.md')!.content).toContain('id:e1')

      a.move('e1', at(8, 8), S(3)) // back to its first day, earlier in the day
      await a.sync(store)
      expect([...store.files.keys()].sort()).toEqual([OLD_DAY])
      expect(store.files.get(OLD_DAY)!.content.indexOf('id:e1')).toBeLessThan(store.files.get(OLD_DAY)!.content.indexOf('id:e2'))
    })

    it('a new time on the same day just reorders that day’s file', async () => {
      const store = memoryStore()
      const a = device()
      a.add('first', at(8, 9), 'e1')
      a.add('second', at(8, 10), 'e2')
      await a.sync(store)
      a.move('e1', at(8, 11), S(1))
      await a.sync(store)
      const text = store.files.get(OLD_DAY)!.content
      expect(text.indexOf('id:e2')).toBeLessThan(text.indexOf('id:e1'))
      expect(store.files.size).toBe(1)
    })

    it('moving an entry before its first sync leaves no file for the day it never reached', async () => {
      const store = memoryStore()
      const a = device()
      a.add('draft', at(8, 10), 'e1')
      a.move('e1', at(9, 7), S(1))
      await a.sync(store)
      expect([...store.files.keys()]).toEqual([NEW_DAY])
    })

    it('an entry deleted after it was moved is gone from both days', async () => {
      const store = memoryStore()
      const a = device()
      a.add('moves', at(8, 10), 'e1')
      a.add('stays', at(8, 11), 'e2')
      await a.sync(store)
      a.move('e1', at(9, 7), S(1))
      a.remove('e1', S(2))
      await a.sync(store)
      expect(store.files.get(OLD_DAY)!.content).not.toContain('id:e1')
      expect(store.files.has(NEW_DAY)).toBe(false)
    })
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
