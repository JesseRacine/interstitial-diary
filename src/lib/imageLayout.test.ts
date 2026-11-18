import { describe, expect, it, vi } from 'vitest'
import type { ImageRef } from './entry'
import { imageLayout } from './imageLayout'
import { UrlCache } from './urlCache'

const img = (w: number, h: number, n = 0): ImageRef => ({ hash: `h${n}`.padEnd(16, '0'), ext: 'jpg', w, h })

it('imageLayout: one photo is capped and never enlarged, an unknown size gets a square, 5 or more show 4 and +N', () => {
  expect(imageLayout([])).toEqual({ kind: 'none' })
  expect(imageLayout([img(4032, 3024)])).toMatchObject({ kind: 'single', width: 320, height: 240 })
  expect(imageLayout([img(3024, 4032)])).toMatchObject({ kind: 'single', width: 195, height: 260 })
  expect(imageLayout([img(100, 50)])).toMatchObject({ kind: 'single', width: 100, height: 50 })
  expect(imageLayout([img(0, 0)])).toMatchObject({ kind: 'single', width: 160, height: 160 })
  expect(imageLayout([img(1, 1, 1), img(1, 1, 2), img(1, 1, 3)])).toMatchObject({ kind: 'grid', more: 0 })
  const l = imageLayout(Array.from({ length: 7 }, (_, i) => img(10, 10, i)))
  expect(l.kind === 'grid' && [l.shown.length, l.more]).toEqual([4, 3])
})

describe('UrlCache', () => {
  it('shares one URL per key, never revokes one in use, and revokes the oldest idle beyond the limit', async () => {
    const revoked: string[] = []
    let n = 0
    const load = vi.fn(async (k: string) => new Blob([k]))
    const cache = new UrlCache({ load, create: () => `blob:${++n}`, revoke: (u) => revoked.push(u) }, 1)
    const [a, b] = await Promise.all([cache.acquire('x'), cache.acquire('x')])
    expect([a, b]).toEqual(['blob:1', 'blob:1'])
    expect(load).toHaveBeenCalledOnce()
    cache.release('x')
    await cache.acquire('y'); cache.release('y')
    await cache.acquire('z'); cache.release('z')
    expect(revoked).toEqual(['blob:2']) // 'x' still has a user; 'y' was the oldest idle one
  })

  it('a thumbnail that was missing is loaded once it arrives (retry), for every user of it', async () => {
    const revoked: string[] = []
    let arrived = false
    const cache = new UrlCache({
      load: async () => (arrived ? new Blob(['t']) : null),
      create: () => 'blob:t',
      revoke: (u) => revoked.push(u),
    }, 0)
    expect(await cache.acquire('k')).toBeNull()
    expect(await cache.acquire('k')).toBeNull() // two rows show the same photo
    arrived = true // sync brought the thumbnail
    expect(await cache.retry('k')).toBe('blob:t')
    cache.release('k')
    expect(revoked).toEqual([])
    cache.release('k')
    expect(revoked).toEqual(['blob:t'])
  })
})
