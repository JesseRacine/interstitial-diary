import { describe, expect, it, vi } from 'vitest'
import type { ImageRef } from './entry'
import { imageLayout } from './imageLayout'
import { UrlCache } from './urlCache'

const img = (w: number, h: number, n = 0): ImageRef => ({ hash: `h${n}`.padEnd(16, '0'), ext: 'jpg', w, h })

describe('imageLayout', () => {
  it('shows nothing without images', () => {
    expect(imageLayout([])).toEqual({ kind: 'none' })
  })

  it('one landscape photo fills up to 320 wide', () => {
    expect(imageLayout([img(4032, 3024)])).toMatchObject({ kind: 'single', width: 320, height: 240 })
  })

  it('one portrait photo is capped at 260 tall', () => {
    expect(imageLayout([img(3024, 4032)])).toMatchObject({ kind: 'single', width: 195, height: 260 })
  })

  it('a small photo is not enlarged', () => {
    expect(imageLayout([img(100, 50)])).toMatchObject({ kind: 'single', width: 100, height: 50 })
  })

  it('an unknown size gets a fixed square, so the row height is still known', () => {
    expect(imageLayout([img(0, 0)])).toMatchObject({ kind: 'single', width: 160, height: 160 })
  })

  it('2 to 4 photos make a grid', () => {
    expect(imageLayout([img(1, 1, 1), img(1, 1, 2), img(1, 1, 3)])).toMatchObject({ kind: 'grid', more: 0 })
  })

  it('5 or more show the first 4 and +N', () => {
    const l = imageLayout(Array.from({ length: 7 }, (_, i) => img(10, 10, i)))
    expect(l.kind === 'grid' && [l.shown.length, l.more]).toEqual([4, 3])
  })
})

describe('UrlCache', () => {
  const setup = (maxIdle = 2) => {
    const revoked: string[] = []
    let n = 0
    const load = vi.fn(async (k: string) => (k.startsWith('missing') ? null : new Blob([k])))
    const cache = new UrlCache({ load, create: () => `blob:${++n}`, revoke: (u) => revoked.push(u) }, maxIdle)
    return { cache, revoked, load }
  }

  it('shares one URL between users and loads once', async () => {
    const { cache, load } = setup()
    const [a, b] = await Promise.all([cache.acquire('x'), cache.acquire('x')])
    expect(a).toBe('blob:1')
    expect(b).toBe('blob:1')
    expect(load).toHaveBeenCalledOnce()
  })

  it('never revokes a URL that is in use', async () => {
    const { cache, revoked } = setup(0)
    await cache.acquire('x')
    await cache.acquire('x')
    cache.release('x')
    expect(revoked).toEqual([]) // one user left
    cache.release('x')
    expect(revoked).toEqual(['blob:1']) // maxIdle 0: revoked as soon as nobody uses it
  })

  it('keeps recently used URLs and revokes the oldest beyond the limit', async () => {
    const { cache, revoked, load } = setup(2)
    for (const k of ['a', 'b', 'c']) { await cache.acquire(k); cache.release(k) }
    expect(revoked).toEqual(['blob:1']) // 'a' was the oldest idle one
    await cache.acquire('c') // still cached
    expect(load).toHaveBeenCalledTimes(3)
    cache.release('c')
    cache.release('c') // extra releases are ignored
    expect(cache.size).toBe(2)
  })

  it('does not remember a missing thumbnail, so one that arrives later is shown', async () => {
    const { cache, load } = setup()
    expect(await cache.acquire('missing-1')).toBeNull()
    cache.release('missing-1')
    await cache.acquire('missing-1')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('retry loads a key that had nothing, for every user of it, without changing the count', async () => {
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
    expect(await cache.acquire('k')).toBe('blob:t') // a third user gets it straight away
    expect(await cache.retry('k')).toBe('blob:t') // retrying a loaded key changes nothing
    cache.release('k')
    cache.release('k')
    expect(revoked).toEqual([])
    cache.release('k')
    expect(revoked).toEqual(['blob:t'])
    expect(await cache.retry('gone')).toBeNull()
  })
})
