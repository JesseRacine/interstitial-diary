import { describe, expect, it } from 'vitest'
import { KeySet } from './keySet'

describe('KeySet', () => {
  it('notifies only when the keys change', () => {
    const s = new KeySet()
    let calls = 0
    const off = s.subscribe(() => calls++)
    expect(s.replace(['a', 'b'])).toBe(true)
    expect(s.has('a')).toBe(true)
    expect(s.replace(['b', 'a'])).toBe(false) // same keys, other order: a quiet sync re-renders nothing
    expect(calls).toBe(1)
    expect(s.replace(['b'])).toBe(true)
    expect(s.has('a')).toBe(false)
    expect(s.replace(['b', 'c'])).toBe(true) // same size, different keys
    off()
    s.replace([])
    expect(calls).toBe(3)
    expect(s.size).toBe(0)
  })
})
