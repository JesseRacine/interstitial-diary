import { describe, expect, it } from 'vitest'
import { hashBytes } from '../lib/images'
import { memoryStore } from './memory'
import {
  type CachedOriginal, ORIGINALS_CACHE_BYTES, ORIGINALS_LIMIT_CHOICES, chooseEvictions, fetchOriginal, limitBytes, limitMode,
  normaliseLimit,
} from './originals'

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

  it('an unlimited cache (Infinity) drops nothing, however much there is', () => {
    expect(chooseEvictions([r('a', 1e12, 1, 1), r('b', 1e12, 1, 2)], Infinity)).toEqual([])
  })
})

describe('cache limit setting', () => {
  it('the default is one of the choices', () => {
    expect(ORIGINALS_LIMIT_CHOICES.map((c) => c.bytes)).toContain(ORIGINALS_CACHE_BYTES)
  })

  it('keeps a valid saved value, including 0 (no limit)', () => {
    for (const c of ORIGINALS_LIMIT_CHOICES) expect(normaliseLimit(c.bytes)).toBe(c.bytes)
    expect(normaliseLimit(0)).toBe(0)
  })

  it('anything else falls back to the default, so a bad value can never make the cache drop photos', () => {
    for (const bad of [undefined, null, 'abc', '1024', -1, NaN, 1, 123456, Infinity, {}]) {
      expect(normaliseLimit(bad)).toBe(ORIGINALS_CACHE_BYTES)
    }
  })

  it('0 means no limit and becomes Infinity', () => {
    expect(limitBytes(0)).toBe(Infinity)
    expect(limitBytes(ORIGINALS_CACHE_BYTES)).toBe(ORIGINALS_CACHE_BYTES)
  })
})

describe('limitMode', () => {
  it('applies only with a separate, reachable storage', () => {
    expect(limitMode('folder', false, false)).toBe('applies')
  })
  it('does nothing without storage', () => expect(limitMode(null, false, false)).toBe('no-storage'))
  it('does nothing with files inside the browser, which are not a separate copy', () => {
    expect(limitMode('browser', true, false)).toBe('inside-browser')
    expect(limitMode('browser', true, true)).toBe('inside-browser')
  })
  it('waits while storage needs permission again', () => expect(limitMode('folder', false, true)).toBe('paused'))
})
