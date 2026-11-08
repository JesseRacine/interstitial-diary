import { describe, expect, it } from 'vitest'
import { extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'
import { merge } from './merge'

const at = (h: number, m = 0) => new Date(2026, 10, 8, h, m).getTime()
const DAY = '2026-11-08'

describe('tags', () => {
  it('extracts tags, ignoring C# and a#b', () => {
    expect(extractTags('Did #Work and #deep-focus. C# code, a#b, #work again, #wip-')).toEqual(['work', 'deep-focus', 'wip'])
  })
  it('replaces whole tags only', () => {
    expect(replaceTag('#work #workout #Work', 'work', 'job')).toBe('#job #workout #job')
  })
})

describe('markdown day files', () => {
  const entries = [
    makeEntry('Second entry\nwith two lines #work', at(10, 30), 'b'),
    makeEntry('First entry', at(9, 14), 'a'),
    makeEntry('## 12:00 looks like a heading\n\\## and so does this', at(12), 'c'),
  ]

  it('serializes oldest first with a readable title', () => {
    const md = serializeDay(DAY, entries)
    expect(md.startsWith('# Sunday, 8 November 2026\n')).toBe(true)
    expect(md.indexOf('First entry')).toBeLessThan(md.indexOf('Second entry'))
    expect(md).toContain(`## 09:14 <!-- id:a created:${at(9, 14)} updated:${at(9, 14)} -->`)
  })

  it('round-trips', () => {
    const back = parseDay(serializeDay(DAY, entries), DAY)
    expect(back.map((e) => [e.id, e.text, e.createdAt, e.updatedAt])).toEqual(
      [...entries].sort((x, y) => x.createdAt - y.createdAt).map((e) => [e.id, e.text, e.createdAt, e.updatedAt]),
    )
    expect(back.find((e) => e.id === 'b')?.tags).toEqual(['work'])
  })

  it('leaves deleted entries out', () => {
    const md = serializeDay(DAY, [{ ...entries[0], deleted: 1 }, entries[1]])
    expect(md).not.toContain('Second entry')
  })

  it('accepts hand-written headings with stable ids', () => {
    const md = '# whatever\n\n## 14:30\nWrote this in pCloud #manual\n\n## 9:05\nAnother\r\n'
    const a = parseDay(md, DAY)
    const b = parseDay(md, DAY)
    expect(a.map((e) => e.text)).toEqual(['Wrote this in pCloud #manual', 'Another'])
    expect(a[0].createdAt).toBe(at(14, 30))
    expect(a[1].createdAt).toBe(at(9, 5))
    expect(a.map((e) => e.id)).toEqual(b.map((e) => e.id))
  })
})

describe('merge', () => {
  const base = makeEntry('original', at(9), 'x')

  it('unions concurrent adds from two devices', () => {
    const mine = makeEntry('from windows', at(10), 'w')
    const theirs = makeEntry('from android', at(10, 1), 'p')
    const r = merge([base, mine], [base, theirs], {})
    expect(r.entries.map((e) => e.id).sort()).toEqual(['p', 'w', 'x'])
  })

  it('newest edit wins', () => {
    const local = { ...base, text: 'edited on windows', updatedAt: at(11) }
    const remote = { ...base, text: 'edited on android', updatedAt: at(12) }
    expect(merge([local], [remote], {}).entries[0].text).toBe('edited on android')
    expect(merge([remote], [local], {}).entries[0].text).toBe('edited on android')
  })

  it('a remote deletion beats an older local version', () => {
    const r = merge([base], [], { x: at(11) })
    expect(r.entries[0].deleted).toBe(1)
  })

  it('a local deletion is recorded as a tombstone', () => {
    const r = merge([{ ...base, deleted: 1, updatedAt: at(11) }], [base], {})
    expect(r.entries[0].deleted).toBe(1)
    expect(r.tombstones).toEqual({ x: at(11) })
  })

  it('an edit made after a deletion wins', () => {
    const edited = { ...base, text: 'revived', updatedAt: at(12) }
    const r = merge([edited], [], { x: at(11) })
    expect(r.entries[0]).toMatchObject({ deleted: 0, text: 'revived' })
  })

  it('a deletion wins a tie', () => {
    const r = merge([{ ...base, updatedAt: at(11) }], [{ ...base, deleted: 1, updatedAt: at(11) }], {})
    expect(r.entries[0].deleted).toBe(1)
  })
})
