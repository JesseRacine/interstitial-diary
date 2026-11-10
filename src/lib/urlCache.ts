/*
 * Object URLs for thumbnails, shared by every place that shows them.
 * - acquire() on mount, release() on unmount (reference counted).
 * - A URL nobody uses is kept in a small LRU, so scrolling back up doesn't reload it; past the limit it is revoked.
 * - A URL in use is never revoked.
 * Pure apart from the injected create/revoke/load, so it is tested in Node.
 */

export interface UrlCacheDeps {
  load: (key: string) => Promise<Blob | null>
  create: (b: Blob) => string
  revoke: (url: string) => void
}

interface Slot {
  url: Promise<string | null>
  resolved: string | null
  refs: number
}

export class UrlCache {
  private slots = new Map<string, Slot>()
  private idle: string[] = [] // keys with refs === 0, oldest first
  private deps: UrlCacheDeps
  private maxIdle: number

  constructor(deps: UrlCacheDeps, maxIdle = 150) {
    this.deps = deps
    this.maxIdle = maxIdle
  }

  acquire(key: string): Promise<string | null> {
    let s = this.slots.get(key)
    if (!s) {
      const slot: Slot = { url: Promise.resolve(null), resolved: null, refs: 0 }
      slot.url = this.deps.load(key).then(
        (b) => {
          if (!b || this.slots.get(key) !== slot) return null // evicted while loading
          slot.resolved = this.deps.create(b)
          return slot.resolved
        },
        () => null,
      )
      this.slots.set(key, slot)
      s = slot
    }
    if (s.refs === 0) this.idle = this.idle.filter((k) => k !== key)
    s.refs++
    return s.url
  }

  release(key: string): void {
    const s = this.slots.get(key)
    if (!s || s.refs === 0) return
    s.refs--
    if (s.refs > 0) return
    if (!s.resolved) {
      // Nothing to show (yet): don't remember that, so a thumbnail that arrives later (sync) is picked up.
      this.slots.delete(key)
      return
    }
    this.idle.push(key)
    while (this.idle.length > this.maxIdle) this.evict(this.idle.shift()!)
  }

  private evict(key: string) {
    const s = this.slots.get(key)
    if (!s) return
    this.slots.delete(key)
    if (s.resolved) this.deps.revoke(s.resolved)
  }

  get size() { return this.slots.size }
}
