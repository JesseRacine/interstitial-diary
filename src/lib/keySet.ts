/**
 * A set of keys that components can watch, one key at a time (e.g. "is this photo missing everywhere?").
 * Replacing it with the same keys notifies nobody, so a sync that changes nothing re-renders nothing.
 */
export class KeySet {
  private keys: ReadonlySet<string> = new Set()
  private listeners = new Set<() => void>()

  has = (key: string): boolean => this.keys.has(key)

  get size() { return this.keys.size }

  /** Replace the whole set. Returns whether anything changed. */
  replace(keys: Iterable<string>): boolean {
    const next = new Set(keys)
    if (next.size === this.keys.size && [...next].every((k) => this.keys.has(k))) return false
    this.keys = next
    this.listeners.forEach((l) => l())
    return true
  }

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }
}
