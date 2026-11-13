import { describe, expect, it } from 'vitest'
import { type ImageRef, extractTags, makeEntry, replaceTag, tagBeingTyped, tagSegments } from './entry'
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
  it('replaces a tag with a hyphen or slash in its name (this used to throw)', () => {
    expect(replaceTag('#deep-focus #deep-focused #a/b', 'deep-focus', 'focus')).toBe('#focus #deep-focused #a/b')
    expect(replaceTag('#a/b', 'a/b', 'c')).toBe('#c')
  })

  it('extracts people and places with their symbol, lowercase, in text order', () => {
    expect(extractTags('Lunch with @Sarah_Jones at ~Blue_Door #food, then @tom')).toEqual(['@sarah_jones', '~blue_door', 'food', '@tom'])
    expect(extractTags('@sarah-')).toEqual(['@sarah'])
  })
  it('keeps a person and a plain tag of the same name apart', () => {
    expect(extractTags('#sarah @sarah ~sarah')).toEqual(['sarah', '@sarah', '~sarah'])
  })
  it('ignores emails, doubled symbols, strikethrough, numbers and words glued to a symbol', () => {
    expect(extractTags('mail bob@example.com, @@x, ~~gone~~, ~5 min, @3pm, a~b, x#y, &#39;')).toEqual([])
  })
  it('stops a name at punctuation, so possessives work', () => {
    expect(extractTags("Sarah's idea from @sarah's phone, ~home.")).toEqual(['@sarah', '~home'])
  })
  it('finds a tag at the very start and after a newline or bracket', () => {
    expect(extractTags('@ann\n(~park) [#x]')).toEqual(['@ann', '~park', 'x'])
  })
  it('cuts text into plain pieces and tags that join back into the text', () => {
    const text = "Met @Sarah_Jones at ~Blue_Door - #wip-, mail bob@x.com. #end"
    const segs = tagSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.key).map((s) => [s.text, s.key])).toEqual([
      ['@Sarah_Jones', '@sarah_jones'],
      ['~Blue_Door', '~blue_door'],
      ['#wip', 'wip'],
      ['#end', 'end'],
    ])
    expect(tagSegments('#wip-, x').map((s) => s.text)).toEqual(['#wip', '-, x'])
    expect(tagSegments('')).toEqual([])
    expect(tagSegments('no tags')).toEqual([{ text: 'no tags' }])
  })
  it('finds the tag being typed at the caret', () => {
    expect(tagBeingTyped('lunch with @Sa')).toMatchObject({ partial: 'sa', start: 11, kind: { id: 'person' } })
    expect(tagBeingTyped('at ~')).toMatchObject({ partial: '', start: 3, kind: { id: 'place' } })
    expect(tagBeingTyped('#wo')).toMatchObject({ partial: 'wo', start: 0, kind: { id: 'tag' } })
    expect(tagBeingTyped('-@sa')).toMatchObject({ partial: 'sa', kind: { id: 'person' } })
    expect(tagBeingTyped('bob@exa')).toBeNull()
    expect(tagBeingTyped('@@sa')).toBeNull()
    expect(tagBeingTyped('@sarah and')).toBeNull()
    expect(tagBeingTyped('plain')).toBeNull()
  })
  it('replaces only the tag of its own kind', () => {
    expect(replaceTag('@sarah #sarah ~sarah @sarahs', '@sarah', '@sara')).toBe('@sara #sarah ~sarah @sarahs')
    expect(replaceTag('@sarah #sarah ~sarah', 'sarah', 'sara')).toBe('@sarah #sara ~sarah')
    expect(replaceTag('~the_cafe', '~the_cafe', '~cafe')).toBe('~cafe')
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

describe('markdown images', () => {
  const A: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
  const B: ImageRef = { hash: '9c01aa22f3b6d710', ext: 'png', w: 800, h: 600 }
  const one = (md: string) => parseDay(md, DAY)[0]

  it('writes the text, a blank line, then one line per image', () => {
    const md = serializeDay(DAY, [makeEntry('Finished the sketch #work', at(9, 14), 'x', [A, B])])
    expect(md).toBe(
      '# Sunday, 8 November 2026\n\n' +
        `## 09:14 <!-- id:x created:${at(9, 14)} updated:${at(9, 14)} -->\n` +
        'Finished the sketch #work\n\n' +
        '![640x480](images/3f9a2c1b7d04e8aa.jpg)\n' +
        '![800x600](images/9c01aa22f3b6d710.png)\n',
    )
  })

  it('round-trips text and images; image lines are not part of the text', () => {
    const e = makeEntry('Line one\nLine two #work', at(9), 'x', [A, B])
    const back = one(serializeDay(DAY, [e]))
    expect(back.text).toBe('Line one\nLine two #work')
    expect(back.images).toEqual([A, B])
    expect(back.tags).toEqual(['work'])
  })

  it('round-trips text plus 10 images', () => {
    const imgs = Array.from({ length: 10 }, (_, i): ImageRef => ({ hash: `${i}`.repeat(16), ext: 'jpg', w: 10 + i, h: 20 }))
    const back = one(serializeDay(DAY, [makeEntry('ten', at(9), 'x', imgs)]))
    expect(back.text).toBe('ten')
    expect(back.images).toEqual(imgs)
  })

  it('writes files without images exactly as before', () => {
    const md = serializeDay(DAY, [makeEntry('First entry', at(9, 14), 'a'), makeEntry('Second\n## 10:00 x', at(10, 30), 'b')])
    expect(md).toBe(
      '# Sunday, 8 November 2026\n\n' +
        `## 09:14 <!-- id:a created:${at(9, 14)} updated:${at(9, 14)} -->\nFirst entry\n\n` +
        `## 10:30 <!-- id:b created:${at(10, 30)} updated:${at(10, 30)} -->\nSecond\n\\## 10:00 x\n`,
    )
    expect('images' in one(md)).toBe(false)
  })

  it('reads image lines without WxH as size 0', () => {
    const e = one(`## 09:00 <!-- id:x created:${at(9)} updated:${at(9)} -->\nhi\n![](images/3f9a2c1b7d04e8aa.jpg)\n`)
    expect(e.images).toEqual([{ ...A, w: 0, h: 0 }])
    expect(serializeDay(DAY, [e])).toContain('\nhi\n\n![](images/3f9a2c1b7d04e8aa.jpg)\n')
  })

  it('allows blank lines between image lines and handles CRLF', () => {
    const md = `## 09:00 <!-- id:x created:${at(9)} updated:${at(9)} -->\r\nhi\r\n\r\n![640x480](images/3f9a2c1b7d04e8aa.jpg)\r\n\r\n![800x600](images/9c01aa22f3b6d710.png)\r\n`
    const e = one(md)
    expect(e.text).toBe('hi')
    expect(e.images).toEqual([A, B])
  })

  it('leaves other image syntax as plain text', () => {
    const body = 'see\n![](https://example.com/a.jpg)\n![x](images/notahash.jpg)\n![](images/3F9A2C1B7D04E8AA.JPG)'
    const e = one(`## 09:00 <!-- id:x created:${at(9)} updated:${at(9)} -->\n${body}\n`)
    expect(e.text).toBe(body)
    expect('images' in e).toBe(false)
  })

  it('keeps an image line in the middle of the text as text', () => {
    const body = 'before\n![640x480](images/3f9a2c1b7d04e8aa.jpg)\nafter'
    const e = one(`## 09:00 <!-- id:x created:${at(9)} updated:${at(9)} -->\n${body}\n`)
    expect(e.text).toBe(body)
    expect('images' in e).toBe(false)
  })

  it('escapes text that would be read as an image line, so it stays text', () => {
    const e = makeEntry('my last line\n![640x480](images/3f9a2c1b7d04e8aa.jpg)', at(9), 'x')
    const md = serializeDay(DAY, [e])
    expect(md).toContain('\n\\![640x480](images/3f9a2c1b7d04e8aa.jpg)\n')
    const back = one(md)
    expect(back.text).toBe(e.text)
    expect('images' in back).toBe(false)
    expect(serializeDay(DAY, [back])).toBe(md)
  })

  it('keeps an entry whose text was removed by hand, leaving only images', () => {
    const e = one(`## 09:00 <!-- id:x created:${at(9)} updated:${at(9)} -->\n![640x480](images/3f9a2c1b7d04e8aa.jpg)\n`)
    expect(e.text).toBe('')
    expect(e.images).toEqual([A])
    expect(one(serializeDay(DAY, [e])).images).toEqual([A])
  })

  it('gives a hand-written entry with an image line the same id as before images existed', () => {
    // The id the previous app version (5d66390) generated for this entry.
    const md = '# x\n\n## 14:30\nLunch with Sam #food\n\n![640x480](images/3f9a2c1b7d04e8aa.jpg)\n'
    const e = one(md)
    expect(e.id).toBe('h2026110814307kd8vm')
    expect(e.text).toBe('Lunch with Sam #food')
    expect(e.images).toEqual([A])
  })
})

describe('merge', () => {
  const base = makeEntry('original', at(9), 'x')

  it('images go with the winning version', () => {
    const img: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 1, h: 1 }
    const withImg = { ...base, images: [img], updatedAt: at(12) }
    const without = { ...base, updatedAt: at(11) }
    expect(merge([without], [withImg], {}).entries[0].images).toEqual([img])
    expect(merge([withImg], [{ ...without, updatedAt: at(13) }], {}).entries[0].images).toBeUndefined()
  })

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
