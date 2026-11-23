import { describe, expect, it } from 'vitest'
import { type ImageRef, extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'
import { canHaveNotes, computeNotes, isNote, journalEntries, noteOf, noteText } from './notes'

const IMG: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }

/** An entry written at a given hour on 2026-11-16, with an id. */
const entry = (id: string, hour: number, text: string, deleted: 0 | 1 = 0, images?: ImageRef[]) =>
  ({ ...makeEntry(text, new Date(2026, 10, 16, hour).getTime(), id, images), deleted })

const keyOf = (text: string) => noteOf(text)?.key ?? null

describe('notes on restaurants', () => {
  it('=$name is a note about that restaurant, apart from a place of the same name', () => {
    expect(noteOf('=$blue_door Try the lamb')).toEqual({ key: '$blue_door', end: 11, note: 'Try the lamb' })
    expect(keyOf('  =$Nobu/ closed Mondays')).toBe('$nobu')
    for (const text of ['=$20 lunch', '=$', '=$ nobu', 'Dinner =$nobu fact', '=@$nobu fact']) expect(keyOf(text), text).toBeNull()
    expect(canHaveNotes('$blue_door')).toBe(true)
    expect(noteText('$blue_door', ' Try the lamb ')).toBe('=$blue_door Try the lamb')
    expect(() => noteText('work', 'x')).toThrow()
  })

  it('shows on the restaurant, renaming follows, and the note is not a journal entry', () => {
    const es = [
      entry('a', 9, '=$blue_door Try the lamb'),
      entry('b', 10, '=~blue_door Free parking'),
      entry('c', 11, 'Dinner at $blue_door'),
    ]
    const notes = computeNotes(es)
    expect(notes.get('$blue_door')?.map((n) => n.note)).toEqual(['Try the lamb'])
    expect(notes.get('~blue_door')?.map((n) => n.note)).toEqual(['Free parking'])
    expect(journalEntries(es).map((e) => e.id)).toEqual(['c'])
    expect(replaceTag(es[0].text, '$blue_door', '$blue_door_sf')).toBe('=$blue_door_sf Try the lamb')
    expect(extractTags(es[0].text)).toEqual(['$blue_door'])
    expect(parseDay(serializeDay('2026-11-16', [es[0]]), '2026-11-16').map((e) => e.text)).toEqual(['=$blue_door Try the lamb'])
  })
})

describe('reading the marker', () => {
  it('=@name or =~name at the very start (after spaces) makes a note about that person or place', () => {
    expect(noteOf('=@sam_jones Allergic to shellfish')).toEqual({ key: '@sam_jones', end: 11, note: 'Allergic to shellfish' })
    expect(noteOf('=~blue_door Closed on Mondays')).toEqual({ key: '~blue_door', end: 11, note: 'Closed on Mondays' })
    const rows: [string, string][] = [
      ['=@Maria Birthday 3 March', '@maria'],
      ['  =@sam likes jazz', '@sam'],
      ['\n\t=~gym opens at 6', '~gym'],
      ['=@jean-luc/work fact', '@jean-luc/work'],
      ['=@sam- fact', '@sam'], // a trailing - or / is dropped, like a tag
      ['=@zoë fact', '@zoë'],
      ['=~café_nord/ fact', '~café_nord'],
    ]
    for (const [text, key] of rows) expect(keyOf(text), text).toBe(key)
    expect(isNote({ text: '=~home fact' })).toBe(true)
    expect(isNote({ text: 'Lunch with @sam at ~home' })).toBe(false)
  })

  it('is not a note anywhere but the start, without a name right after the =, or for tags, events and tracked items', () => {
    for (const text of [
      'Lunch. =@sam likes jazz', 'x=@sam fact', 'first line\n=~home fact', '(=@sam fact)',
      '=@ sam', '=@', '=~', '=@3pm meeting', '=~5 min walk', '= @sam fact', '=sam fact', '==@sam fact', '=@~sam fact', '@sam fact',
      '=#work fact', '=!"Jack\'s 40th" fact', '=+"Dyson V15" fact',
    ]) expect(keyOf(text), text).toBeNull()
  })

  it('the note is the text after the name, without the spaces and one colon after it; other names are mentions', () => {
    const rows: [string, string][] = [
      ['=@sam: likes jazz', 'likes jazz'],
      ['=~home :spare key', 'spare key'],
      ['=@sam\nlikes jazz\nand blues  ', 'likes jazz\nand blues'],
      ['=@sam:: odd', ': odd'],
      ['=~home   ', ''],
      ['=@sam married to @maria', 'married to @maria'],
    ]
    for (const [text, note] of rows) expect(noteOf(text)?.note, text).toBe(note)
    expect(noteOf('=@sam')).toEqual({ key: '@sam', end: 5, note: '' })
  })
})

describe('the person or place is an ordinary tag', () => {
  it('extractTags finds it and the other tags in a note', () => {
    expect(extractTags('=@sam_jones married to @maria #family')).toEqual(['@sam_jones', '@maria', 'family'])
  })

  it('renaming rewrites the marker (only for its own kind) and keeps the rest byte for byte', () => {
    const text = '=@sam  likes jazz, see @sam'
    expect(replaceTag(text, '@sam', '@samuel')).toBe('=@samuel  likes jazz, see @samuel')
    expect(noteOf(replaceTag(text, '@sam', '@samuel'))?.key).toBe('@samuel')
    expect(replaceTag('=~blue_door closed Mondays', '~blue_door', '~the_blue_door')).toBe('=~the_blue_door closed Mondays')
    expect(replaceTag('=@sam married to @maria', '@maria', '@mary')).toBe('=@sam married to @mary')
    expect(replaceTag('=@sam see #sam', 'sam', 'samuel')).toBe('=@sam see #samuel')
    expect(replaceTag('=~sam see @sam', '@sam', '@samuel')).toBe('=~sam see @samuel')
  })
})

it('noteText writes =@name or =~name and the trimmed note, reads back, and refuses plain tags', () => {
  expect(noteText('@sam_jones', '  Allergic to shellfish \n')).toBe('=@sam_jones Allergic to shellfish')
  expect(noteText('@sam', '')).toBe('=@sam')
  expect(noteOf(noteText('@jean-luc', 'Line one\nLine two'))).toMatchObject({ key: '@jean-luc', note: 'Line one\nLine two' })
  expect(noteOf(noteText('~café_nord', 'Cash only'))).toMatchObject({ key: '~café_nord', note: 'Cash only' })
  expect(() => noteText('work', 'x')).toThrow()
  expect([canHaveNotes('work'), canHaveNotes('@sam'), canHaveNotes('~home')]).toEqual([false, true, true])
})

describe('computeNotes', () => {
  it('groups notes by person or place, newest first, keeping a person and a place of one name apart', () => {
    const list = [
      entry('A', 9, '=@sam Likes jazz'),
      entry('B', 10, 'Lunch with @sam at ~blue_door'),
      entry('C', 11, '=~blue_door Closed on Mondays'),
      entry('D', 12, '=@sam Allergic to shellfish'),
      entry('E', 13, '=@sam Deleted fact', 1),
      entry('F', 9, '=~sam a place'),
    ]
    const notes = computeNotes(list)
    expect([...notes.keys()].sort()).toEqual(['@sam', '~blue_door', '~sam'])
    expect(notes.get('@sam')!.map((n) => n.note)).toEqual(['Allergic to shellfish', 'Likes jazz'])
    expect(notes.get('~blue_door')![0]).toMatchObject({ id: 'C', key: '~blue_door', note: 'Closed on Mondays' })
    expect(computeNotes([entry('A', 9, 'Lunch with @sam')]).size).toBe(0)
  })

  it('orders notes of the same moment by id, and keeps photos', () => {
    const notes = computeNotes([entry('A', 9, '=@sam one'), entry('B', 9, '=@sam two', 0, [IMG])]).get('@sam')!
    expect(notes.map((n) => n.id)).toEqual(['B', 'A'])
    expect(notes[0].images).toEqual([IMG])
  })
})

it('journalEntries leaves out notes and keeps every other entry, in order', () => {
  const list = [entry('A', 9, 'Lunch with @sam'), entry('B', 10, '=@sam fact'), entry('C', 11, 'x =@sam not a note'), entry('D', 12, '=~home fact')]
  expect(journalEntries(list).map((e) => e.id)).toEqual(['A', 'C'])
})

it('the Markdown file keeps a note as typed (it trims leading spaces of any entry; it stays a note)', () => {
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
