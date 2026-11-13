import { describe, expect, it } from 'vitest'
import { memoryStore } from './memory'
import { NO_MARKER, RESET_PATH, eraseStorage, newResetId, readMarker, resetAction, seenValue } from './startOver'
import type { FileStore } from './types'

const M = { id: 'm2', at: 5 }

describe('resetAction', () => {
  it('a device that remembers nothing yet only remembers (connecting keeps its entries)', () => {
    expect(resetAction(undefined, null)).toBe('remember')
    expect(resetAction(undefined, M)).toBe('remember')
  })

  it('a new marker clears a device that had seen none or an older one', () => {
    expect(resetAction(NO_MARKER, M)).toBe('clear')
    expect(resetAction('m1', M)).toBe('clear')
  })

  it('the same marker, or no marker, changes nothing', () => {
    expect(resetAction('m2', M)).toBe('none')
    expect(resetAction(NO_MARKER, null)).toBe('none')
    expect(resetAction('m1', null)).toBe('none') // marker removed by hand: never a reason to erase
  })

  it('remembers the marker id, or "none"', () => {
    expect(seenValue(M)).toBe('m2')
    expect(seenValue(null)).toBe(NO_MARKER)
  })

  it('makes a different id each time', () => {
    expect(newResetId()).not.toBe(newResetId())
  })
})

describe('readMarker', () => {
  it('reads a valid marker and ignores missing or damaged ones', async () => {
    expect(await readMarker(memoryStore())).toBeNull()
    expect(await readMarker(memoryStore({ [RESET_PATH]: JSON.stringify(M) }))).toEqual(M)
    expect(await readMarker(memoryStore({ [RESET_PATH]: 'not json' }))).toBeNull()
    expect(await readMarker(memoryStore({ [RESET_PATH]: '{"id":""}' }))).toBeNull()
  })
})

describe('eraseStorage', () => {
  it('removes the journal and photos, keeps other files, and leaves a marker', async () => {
    const store = memoryStore({
      '2026/2026-11-08.md': 'day', '2025/2025-01-01.md': 'old', '.meta/tombstones.json': '{}', 'notes.md': 'not ours',
    })
    store.blobs.set('2026/images/0123456789abcdef.jpg', new Blob(['x']))
    store.blobs.set('.thumbs/0123456789abcdef.webp', new Blob(['t']))
    const marker = await eraseStorage(store, 'abc', 42)
    expect(marker).toEqual({ id: 'abc', at: 42 })
    expect([...store.files.keys()].sort()).toEqual([RESET_PATH, 'notes.md'])
    expect(store.blobs.size).toBe(0)
    expect(await readMarker(store)).toEqual(marker)
  })

  it('refuses, changing nothing, when the storage can\'t be emptied', async () => {
    const full = memoryStore({ '2026/2026-11-08.md': 'day' })
    const store: FileStore = { list: full.list, read: full.read, write: full.write, remove: full.remove }
    await expect(eraseStorage(store, 'x')).rejects.toThrow(/can’t be emptied/)
    expect([...full.files.keys()]).toEqual(['2026/2026-11-08.md'])
  })
})
