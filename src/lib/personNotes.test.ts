import { describe, expect, it } from 'vitest'
import { type ImageRef, extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'
import { computePersonNotes, isPersonNote, personNoteOf, personNoteText } from './personNotes'

const IMG: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }

/** An entry written at a given hour on 2026-11-16, with an id. */
const entry = (id: string, hour: number, text: string, deleted: 0 | 1 = 0, images?: ImageRef[]) =>
  ({ ...makeEntry(text, new Date(2026, 10, 16, hour).getTime(), id, images), deleted })

const keyOf = (text: string) => personNoteOf(text)?.key ?? null
const noteOf = (text: string) => personNoteOf(text)?.note ?? null

describe('reading the marker', () => {
  it('reads =@name at the start of the text', () => {
    expect(personNoteOf('=@sam_jones Allergic to shellfish')).toEqual({ key: '@sam_jones', end: 11, note: 'Allergic to shellfish' })
    expect(keyOf('=@Maria Birthday 3 March')).toBe('@maria')
  })
  it('allows spaces and line breaks before the marker', () => {
    expect(keyOf('  =@sam likes jazz')).toBe('@sam')
    expect(keyOf('\n\t=@sam likes jazz')).toBe('@sam')
  })
  it('accepts the characters a person name may hold, and drops a trailing - or / like a tag', () => {
    expect(keyOf('=@jean-luc/work fact')).toBe('@jean-luc/work')
    expect(keyOf('=@sam- fact')).toBe('@sam')
    expect(keyOf('=@zoë fact')).toBe('@zoë')
  })
  it('is not a note anywhere but the start', () => {
    expect(keyOf('Lunch. =@sam likes jazz')).toBeNull()
    expect(keyOf('x=@sam fact')).toBeNull()
    expect(keyOf('first line\n=@sam fact')).toBeNull()
    expect(keyOf('(=@sam fact)')).toBeNull()
  })
  it('needs a person name right after =@', () => {
    expect(keyOf('=@ sam')).toBeNull()
    expect(keyOf('=@')).toBeNull()
    expect(keyOf('=@3pm meeting')).toBeNull()
    expect(keyOf('= @sam fact')).toBeNull()
    expect(keyOf('=sam fact')).toBeNull()
    expect(keyOf('==@sam fact')).toBeNull()
    expect(keyOf('=#sam fact')).toBeNull()
    expect(keyOf('=~home fact')).toBeNull()
    expect(keyOf('@sam fact')).toBeNull()
  })
  it('the note is the text after the marker, without the spaces and one colon after it', () => {
    expect(noteOf('=@sam: likes jazz')).toBe('likes jazz')
    expect(noteOf('=@sam :likes jazz')).toBe('likes jazz')
    expect(noteOf('=@sam\nlikes jazz\nand blues  ')).toBe('likes jazz\nand blues')
    expect(noteOf('=@sam:: odd')).toBe(': odd')
  })
  it('a marker with nothing after it is an empty note', () => {
    expect(personNoteOf('=@sam')).toEqual({ key: '@sam', end: 5, note: '' })
    expect(noteOf('=@sam   ')).toBe('')
  })
  it('only the first person is the note\'s person; another is an ordinary mention', () => {
    expect(personNoteOf('=@sam married to @maria')).toMatchObject({ key: '@sam', note: 'married to @maria' })
  })
  it('isPersonNote looks at the entry text', () => {
    expect(isPersonNote({ text: '=@sam fact' })).toBe(true)
    expect(isPersonNote({ text: 'Lunch with @sam' })).toBe(false)
    expect(isPersonNote({ text: '' })).toBe(false)
  })
})

describe('the person is an ordinary tag', () => {
  it('extractTags finds the person and other tags in a note', () => {
    expect(extractTags('=@sam_jones married to @maria #family')).toEqual(['@sam_jones', '@maria', 'family'])
  })
  it('renaming the person rewrites the marker and keeps the rest byte for byte', () => {
    const text = '=@sam  likes jazz, see @sam'
    expect(replaceTag(text, '@sam', '@samuel')).toBe('=@samuel  likes jazz, see @samuel')
    expect(personNoteOf(replaceTag(text, '@sam', '@samuel'))?.key).toBe('@samuel')
  })
  it('renaming another person leaves the marker alone', () => {
    expect(replaceTag('=@sam married to @maria', '@maria', '@mary')).toBe('=@sam married to @mary')
  })
  it('a plain tag of the same name is not the person', () => {
    expect(replaceTag('=@sam see #sam', 'sam', 'samuel')).toBe('=@sam see #samuel')
  })
})

describe('writing a note', () => {
  it('writes =@name and the trimmed note', () => {
    expect(personNoteText('@sam_jones', '  Allergic to shellfish \n')).toBe('=@sam_jones Allergic to shellfish')
    expect(personNoteText('@sam', '')).toBe('=@sam')
  })
  it('reads back what it writes', () => {
    const text = personNoteText('@jean-luc', 'Line one\nLine two')
    expect(personNoteOf(text)).toMatchObject({ key: '@jean-luc', note: 'Line one\nLine two' })
  })
  it('refuses a key that is not a person', () => {
    expect(() => personNoteText('work', 'x')).toThrow()
    expect(() => personNoteText('~home', 'x')).toThrow()
  })
})

describe('computePersonNotes', () => {
  it('groups notes by person, newest first, and skips other and deleted entries', () => {
    const list = [
      entry('A', 9, '=@sam Likes jazz'),
      entry('B', 10, 'Lunch with @sam'),
      entry('C', 11, '=@maria Birthday 3 March'),
      entry('D', 12, '=@sam Allergic to shellfish'),
      entry('E', 13, '=@sam Deleted fact', 1),
    ]
    const notes = computePersonNotes(list)
    expect([...notes.keys()].sort()).toEqual(['@maria', '@sam'])
    expect(notes.get('@sam')!.map((n) => n.note)).toEqual(['Allergic to shellfish', 'Likes jazz'])
    expect(notes.get('@maria')![0]).toMatchObject({ id: 'C', key: '@maria', note: 'Birthday 3 March' })
  })
  it('orders notes of the same moment by id, and keeps photos', () => {
    const notes = computePersonNotes([entry('A', 9, '=@sam one'), entry('B', 9, '=@sam two', 0, [IMG])]).get('@sam')!
    expect(notes.map((n) => n.id)).toEqual(['B', 'A'])
    expect(notes[0].images).toEqual([IMG])
    expect(notes[1].images).toBeUndefined()
  })
  it('gives an empty map with no notes', () => {
    expect(computePersonNotes([entry('A', 9, 'Lunch with @sam')]).size).toBe(0)
  })
})

describe('the Markdown file', () => {
  it('keeps a note as typed through a round trip (the file trims leading spaces of any entry; it stays a note)', () => {
    const notes = [entry('A', 9, '=@sam_jones Allergic to shellfish'), entry('B', 10, '  =@maria: Birthday\n3 March')]
    const back = parseDay(serializeDay('2026-11-16', notes), '2026-11-16')
    expect(back.map((e) => e.text)).toEqual(['=@sam_jones Allergic to shellfish', '=@maria: Birthday\n3 March'])
    expect(back.map((e) => personNoteOf(e.text))).toEqual(notes.map((e) => personNoteOf(e.text.trimStart())))
    expect(back.map((e) => e.tags)).toEqual([['@sam_jones'], ['@maria']])
  })
})
