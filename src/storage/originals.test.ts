import { describe, expect, it } from 'vitest'
import { hashBytes } from '../lib/images'
import { memoryStore } from './memory'
import { type CachedOriginal, chooseEvictions, fetchOriginal } from './originals'

const photo = async (seed: number) => {
  const bytes = new Uint8Array(32).fill(seed)
  return { blob: new Blob([bytes]), ref: { hash: await hashBytes(bytes), ext: 'jpg' } }
}

describe('fetchOriginal', () => {
  it('reads the original from the entry year folder', async () => {
    const { blob, ref } = await photo(1)
    const store = memoryStore()
    store.blobs.set(`2026/images/${ref.hash}.jpg`, blob)
    expect(await fetchOriginal(store, ref, ['2026'])).toBe(blob)
  })

  it('tries the other year folders, and returns null when none has it yet', async () => {
    const { blob, ref } = await photo(2)
    const store = memoryStore()
    expect(await fetchOriginal(store, ref, ['2026', '2025'])).toBeNull()
    store.blobs.set(`2025/images/${ref.hash}.jpg`, blob)
    expect(await fetchOriginal(store, ref, ['2026', '2025'])).toBe(blob)
  })

  it('never takes a file whose bytes do not match its name', async () => {
    const { ref } = await photo(3)
    const { blob: other } = await photo(4)
    const store = memoryStore()
    store.blobs.set(`2026/images/${ref.hash}.jpg`, other) // replaced by hand
    await expect(fetchOriginal(store, ref, ['2026'])).rejects.toThrow(/doesn't match/)
  })

  it('a good copy in another year wins over a bad one', async () => {
    const { blob, ref } = await photo(5)
    const { blob: other } = await photo(6)
    const store = memoryStore()
    store.blobs.set(`2026/images/${ref.hash}.jpg`, other)
    store.blobs.set(`2025/images/${ref.hash}.jpg`, blob)
    expect(await fetchOriginal(store, ref, ['2026', '2025'])).toBe(blob)
  })

  it('a failed read is reported', async () => {
    const { ref } = await photo(7)
    const store = memoryStore()
    store.readBlob = async () => { throw new Error('offline') }
    await expect(fetchOriginal(store, ref, ['2026'])).rejects.toThrow('offline')
  })
})

describe('chooseEvictions', () => {
  const r = (hash: string, size: number, onRemote: 0 | 1, addedAt: number, usedAt?: number): CachedOriginal =>
    ({ hash, size, onRemote, addedAt, usedAt })

  it('drops nothing within the limit', () => {
    expect(chooseEvictions([r('a', 10, 1, 1)], 10)).toEqual([])
  })

  it('drops the least recently used first, until it fits', () => {
    const rows = [r('a', 10, 1, 1, 50), r('b', 10, 1, 2), r('c', 10, 1, 3)]
    expect(chooseEvictions(rows, 15)).toEqual(['b', 'c']) // 'a' was viewed last
  })

  it('never drops an original storage has not confirmed (the only copy)', () => {
    expect(chooseEvictions([r('a', 100, 0, 1), r('b', 10, 1, 2)], 5)).toEqual(['b'])
  })

  it('never drops a kept one (the photo on screen)', () => {
    expect(chooseEvictions([r('a', 10, 1, 1), r('b', 10, 1, 2)], 10, new Set(['a']))).toEqual(['b'])
  })
})
