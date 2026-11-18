import { describe, expect, it } from 'vitest'
import { type ImageRef, extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'
import { canHaveNotes, computeNotes, isNote, noteOf, noteText } from './notes'

const IMG: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }

/** An entry written at a given hour on 2026-11-16, with an id. */
const entry = (id: string, hour: number, text: string, deleted: 0 | 1 = 0, images?: ImageRef[]) =>
  ({ ...makeEntry(text, new Date(2026, 10, 16, hour).getTime(), id, images), deleted })

const keyOf = (text: string) => noteOf(text)?.key ?? null
const textOf = (text: string) => noteOf(text)?.note ?? null

describe('reading the marker', () => {
  it('reads =@name (a person) at the start of the text', () => {
    expect(noteOf('=@sam_jones Allergic to shellfish')).toEqual({ key: '@sam_jones', end: 11, note: 'Allergic to shellfish' })
    expect(keyOf('=@Maria Birthday 3 March')).toBe('@maria')
  })
  it('reads =~name (a place) at the start of the text', () => {
    expect(noteOf('=~blue_door Closed on Mondays')).toEqual({ key: '~blue_door', end: 11, note: 'Closed on Mondays' })
    expect(keyOf('=~Home Spare key under the pot')).toBe('~home')
  })
  it('allows spaces and line breaks before the marker', () => {
    expect(keyOf('  =@sam likes jazz')).toBe('@sam')
    expect(keyOf('\n\t=~gym opens at 6')).toBe('~gym')
  })
  it('accepts the characters a name may hold, and drops a trailing - or / like a tag', () => {
    expect(keyOf('=@jean-luc/work fact')).toBe('@jean-luc/work')
    expect(keyOf('=@sam- fact')).toBe('@sam')
    expect(keyOf('=@zoë fact')).toBe('@zoë')
    expect(keyOf('=~café_nord/ fact')).toBe('~café_nord')
  })
  it('is not a note anywhere but the start', () => {
    expect(keyOf('Lunch. =@sam likes jazz')).toBeNull()
    expect(keyOf('x=@sam fact')).toBeNull()
    expect(keyOf('first line\n=~home fact')).toBeNull()
    expect(keyOf('(=@sam fact)')).toBeNull()
  })
  it('needs a person or place name right after the =', () => {
    expect(keyOf('=@ sam')).toBeNull()
    expect(keyOf('=@')).toBeNull()
    expect(keyOf('=~')).toBeNull()
    expect(keyOf('=@3pm meeting')).toBeNull()
    expect(keyOf('=~5 min walk')).toBeNull()
    expect(keyOf('= @sam fact')).toBeNull()
    expect(keyOf('=sam fact')).toBeNull()
    expect(keyOf('==@sam fact')).toBeNull()
    expect(keyOf('=@~sam fact')).toBeNull()
    expect(keyOf('@sam fact')).toBeNull()
  })
  it('has no notes on plain tags or events', () => {
    expect(keyOf('=#work fact')).toBeNull()
    expect(keyOf('=!"Jack\'s 40th" fact')).toBeNull()
    expect(keyOf('=+"Dyson V15" fact')).toBeNull()
  })
  it('the note is the text after the marker, without the spaces and one colon after it', () => {
    expect(textOf('=@sam: likes jazz')).toBe('likes jazz')
    expect(textOf('=~home :spare key')).toBe('spare key')
    expect(textOf('=@sam\nlikes jazz\nand blues  ')).toBe('likes jazz\nand blues')
    expect(textOf('=@sam:: odd')).toBe(': odd')
  })
  it('a marker with nothing after it is an empty note', () => {
    expect(noteOf('=@sam')).toEqual({ key: '@sam', end: 5, note: '' })
    expect(textOf('=~home   ')).toBe('')
  })
  it('only the first name is the note\'s person or place; another is an ordinary mention', () => {
    expect(noteOf('=@sam married to @maria')).toMatchObject({ key: '@sam', note: 'married to @maria' })
    expect(noteOf('=~blue_door where I met @sam')).toMatchObject({ key: '~blue_door', note: 'where I met @sam' })
  })
  it('isNote looks at the entry text', () => {
    expect(isNote({ text: '=@sam fact' })).toBe(true)
    expect(isNote({ text: '=~home fact' })).toBe(true)
    expect(isNote({ text: 'Lunch with @sam at ~home' })).toBe(false)
    expect(isNote({ text: '' })).toBe(false)
  })
})

describe('the person or place is an ordinary tag', () => {
  it('extractTags finds it and the other tags in a note', () => {
    expect(extractTags('=@sam_jones married to @maria #family')).toEqual(['@sam_jones', '@maria', 'family'])
    expect(extractTags('=~blue_door ask @sam')).toEqual(['~blue_door', '@sam'])
  })
  it('renaming rewrites the marker and keeps the rest byte for byte', () => {
    const text = '=@sam  likes jazz, see @sam'
    expect(replaceTag(text, '@sam', '@samuel')).toBe('=@samuel  likes jazz, see @samuel')
    expect(noteOf(replaceTag(text, '@sam', '@samuel'))?.key).toBe('@samuel')
    expect(replaceTag('=~blue_door closed Mondays', '~blue_door', '~the_blue_door')).toBe('=~the_blue_door closed Mondays')
  })
  it('renaming another name leaves the marker alone', () => {
    expect(replaceTag('=@sam married to @maria', '@maria', '@mary')).toBe('=@sam married to @mary')
  })
  it('a tag of the same name but another kind is not the person or place', () => {
    expect(replaceTag('=@sam see #sam', 'sam', 'samuel')).toBe('=@sam see #samuel')
    expect(replaceTag('=~sam see @sam', '@sam', '@samuel')).toBe('=~sam see @samuel')
  })
})

describe('writing a note', () => {
  it('writes =@name or =~name and the trimmed note', () => {
    expect(noteText('@sam_jones', '  Allergic to shellfish \n')).toBe('=@sam_jones Allergic to shellfish')
    expect(noteText('~blue_door', 'Closed on Mondays')).toBe('=~blue_door Closed on Mondays')
    expect(noteText('@sam', '')).toBe('=@sam')
  })
  it('reads back what it writes', () => {
    expect(noteOf(noteText('@jean-luc', 'Line one\nLine two'))).toMatchObject({ key: '@jean-luc', note: 'Line one\nLine two' })
    expect(noteOf(noteText('~café_nord', 'Cash only'))).toMatchObject({ key: '~café_nord', note: 'Cash only' })
  })
  it('refuses a key that is not a person or a place', () => {
    expect(() => noteText('work', 'x')).toThrow()
    expect(canHaveNotes('work')).toBe(false)
    expect(canHaveNotes('@sam')).toBe(true)
    expect(canHaveNotes('~home')).toBe(true)
  })
})

describe('computeNotes', () => {
  it('groups notes by person or place, newest first, and skips other and deleted entries', () => {
    const list = [
      entry('A', 9, '=@sam Likes jazz'),
      entry('B', 10, 'Lunch with @sam at ~blue_door'),
      entry('C', 11, '=~blue_door Closed on Mondays'),
      entry('D', 12, '=@sam Allergic to shellfish'),
      entry('E', 13, '=@sam Deleted fact', 1),
    ]
    const notes = computeNotes(list)
    expect([...notes.keys()].sort()).toEqual(['@sam', '~blue_door'])
    expect(notes.get('@sam')!.map((n) => n.note)).toEqual(['Allergic to shellfish', 'Likes jazz'])
    expect(notes.get('~blue_door')![0]).toMatchObject({ id: 'C', key: '~blue_door', note: 'Closed on Mondays' })
  })
  it('keeps a person and a place of the same name apart', () => {
    const notes = computeNotes([entry('A', 9, '=@sam a person'), entry('B', 10, '=~sam a place')])
    expect(notes.get('@sam')!.map((n) => n.id)).toEqual(['A'])
    expect(notes.get('~sam')!.map((n) => n.id)).toEqual(['B'])
  })
  it('orders notes of the same moment by id, and keeps photos', () => {
    const notes = computeNotes([entry('A', 9, '=@sam one'), entry('B', 9, '=@sam two', 0, [IMG])]).get('@sam')!
    expect(notes.map((n) => n.id)).toEqual(['B', 'A'])
    expect(notes[0].images).toEqual([IMG])
    expect(notes[1].images).toBeUndefined()
  })
  it('gives an empty map with no notes', () => {
    expect(computeNotes([entry('A', 9, 'Lunch with @sam')]).size).toBe(0)
  })
})

describe('the Markdown file', () => {
  it('keeps a note as typed through a round trip (the file trims leading spaces of any entry; it stays a note)', () => {
    const notes = [
      entry('A', 9, '=@sam_jones Allergic to shellfish'),
      entry('B', 10, '  =@maria: Birthday\n3 March'),
      entry('C', 11, '=~blue_door Closed on Mondays'),
    ]
    const back = parseDay(serializeDay('2026-11-16', notes), '2026-11-16')
    expect(back.map((e) => e.text)).toEqual(['=@sam_jones Allergic to shellfish', '=@maria: Birthday\n3 March', '=~blue_door Closed on Mondays'])
    expect(back.map((e) => noteOf(e.text))).toEqual(notes.map((e) => noteOf(e.text.trimStart())))
    expect(back.map((e) => e.tags)).toEqual([['@sam_jones'], ['@maria'], ['~blue_door']])
  })
})
