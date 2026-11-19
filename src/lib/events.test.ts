import { describe, expect, it } from 'vitest'
import { blankEvents, closingQuote, computeEvents, eventAfterRename, eventBeingTyped, eventKey, eventOfMarker, eventSegments, eventSpans, lastEventTitle, parseEventTitle, renameEventInText, suggestLastEvent } from './events'
import { extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'

/** An entry written at noon local time on a day, with an id. */
const entry = (id: string, day: string, text: string, deleted: 0 | 1 = 0) => {
  const [y, m, d] = day.split('-').map(Number)
  return { ...makeEntry(text, new Date(y, m - 1, d, 12).getTime(), id), deleted }
}

it('suggests while typing: sees !" or !“ being typed, offers the last event written, closes with the matching quote', () => {
  expect(eventBeingTyped('Went to !"Jack')).toEqual({ start: 8, open: '"', partial: 'Jack' })
  expect(eventBeingTyped('!“Beach w')).toEqual({ start: 0, open: '“', partial: 'Beach w' })
  for (const t of ['!"Jack\'s party" and', 'he said "stop!" and "go', 'wow!"ok', '!"line one\nline two']) expect(eventBeingTyped(t), t).toBeNull()
  const entries = [
    entry('c', '2026-06-01', 'first !"Beach weekend" then !"Jack\'s   party" (2026-05-12)'),
    entry('a', '2026-05-01', '!"Older one"'),
    entry('e', '2026-08-01', '!"Deleted one"', 1),
  ]
  expect(lastEventTitle(entries)).toBe("Jack's party") // by when it was written; deleted entries left out
  expect(lastEventTitle([])).toBeUndefined()
  expect(suggestLastEvent('JACK\'S   p', "Jack's party")).toBe(true)
  expect(suggestLastEvent('party', "Jack's party")).toBe(false) // a new event is not pushed toward the old one
  expect(closingQuote('“')).toBe('”')
})

describe('reading events', () => {
  it('finds quoted titles after a ! and nothing else', () => {
    const rows: [string, string[]][] = [
      ['Went to !"Jack\'s 40th birthday" tonight', ["Jack's 40th birthday"]],
      ['!“Beach weekend” was great', ['Beach weekend']],
      ['first !"One" then !"Two"', ['One', 'Two']],
      ['x\n!"Next line"', ['Next line']],
      ['(!"In brackets")', ['In brackets']],
      ['!"  Jack\'s    party "', ["Jack's party"]], // trimmed, spaces collapsed
      ['he said "stop!" and "go"', []],
      ['wow!"x"', []],
      ['!!"x"', []],
      ['![alt](pic.png)', []],
      ['!party', []],
      ['!"   "', []],
      ['!"two\nlines"', []],
      [`!"${'a'.repeat(121)}"`, []],
    ]
    for (const [text, want] of rows) expect(eventSpans(text).map((s) => s.title), text).toEqual(want)
    expect(eventSpans(`!"${'a'.repeat(120)}"`)).toHaveLength(1)
    expect(eventKey("  Jack's   PARTY ")).toBe(eventKey("jack's party"))
  })

  it('reads an own date (YYYY-MM-DD) right after the marker, and only a real one', () => {
    const rows: [string, [string, string | undefined][]][] = [
      [`Great night at !"Jack's 40th" (2026-05-12) with @sam`, [["Jack's 40th", '2026-05-12']]],
      ['!"Trip"(2026-05-12)', [['Trip', '2026-05-12']]],
      ['!"One" (2026-01-02) and !"Two"', [['One', '2026-01-02'], ['Two', undefined]]],
      ['!"Trip" (2026-02-30)', [['Trip', undefined]]],
      ['!"Trip" 2026-05-12', [['Trip', undefined]]],
      ['!"Trip" on (2026-05-12)', [['Trip', undefined]]],
      ['!"Trip"\n(2026-05-12)', [['Trip', undefined]]],
      ['!"Trip" (12 May 2026)', [['Trip', undefined]]],
    ]
    for (const [text, want] of rows) expect(eventSpans(text).map((s) => [s.title, s.date]), text).toEqual(want)
  })

  it('cuts text into pieces that join back exactly, and blanks markers (with their date) without changing the length', () => {
    const text = 'Went to !"Jack\'s party" (2026-05-12) with @sam, then !“Dinner” (2026-02-30) #food'
    const segs = eventSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.title).map((s) => [s.text, s.date])).toEqual([
      ['!"Jack\'s party" (2026-05-12)', '2026-05-12'],
      ['!“Dinner”', undefined], // an unreadable date stays plain text
    ])
    expect(eventSegments('plain')).toEqual([{ text: 'plain' }])
    expect(blankEvents('a !"x" (2026-05-12) #y')).toBe('a ' + ' '.repeat(17) + ' #y')
    expect(blankEvents('no events')).toBe('no events')
  })

  it('events are not tags: tags inside a title are ignored, and renaming a tag leaves titles alone', () => {
    expect(extractTags('!"Jack\'s #party with @sam" #food @tom')).toEqual(['food', '@tom'])
    expect(extractTags('a !"x" (2026-05-12) #y')).toEqual(['y'])
    expect(replaceTag('#party !"My #party" #party', 'party', 'bash')).toBe('#bash !"My #party" #bash')
  })
})

describe('renaming titles', () => {
  it('checks a typed title', () => {
    expect(parseEventTitle("  Jack's   40th ")).toEqual({ title: "Jack's 40th" })
    for (const t of ['   ', 'say "hi"', 'a'.repeat(121)]) expect(parseEventTitle(t), t).toHaveProperty('error')
  })

  it('gives every marker with that title the new one, keeping quote marks, dates and the rest of the text', () => {
    const text = 'Went to !"Jack\'s party" and then !“jack\'s   PARTY” ended; also !"Other" #x'
    expect(renameEventInText(text, eventKey("Jack's party"), 'Jack 40')).toBe('Went to !"Jack 40" and then !“Jack 40” ended; also !"Other" #x')
    const dated = 'Went on !"Trip" (2026-05-12) and !“trip” again, !"Other" (2026-01-01)'
    expect(renameEventInText(dated, eventKey('Trip'), 'Road trip')).toBe('Went on !"Road trip" (2026-05-12) and !“Road trip” again, !"Other" (2026-01-01)')
    expect(renameEventInText('!"A" text', eventKey('B'), 'C')).toBe('!"A" text')
  })
})

describe('computing events', () => {
  it('entries within 7 days of each other are one event; a longer gap (or a year later) starts a new one', () => {
    const events = computeEvents([
      entry('a', '2026-05-01', '!"Trip"'),
      entry('b', '2026-05-08', '!"trip" day two'), // exactly 7 days after a: same event
      entry('c', '2026-05-15', '!"TRIP" day three'), // 7 days after b: still the same
      entry('d', '2026-05-23', '!"Trip"'), // 8 days after c: a new event
    ])
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ title: 'Trip', count: 3, first: '2026-05-01', last: '2026-05-15', entryIds: ['a', 'b', 'c'] })
    expect(events[1]).toMatchObject({ count: 1, first: '2026-05-23' })
    expect(events[0].id).not.toBe(events[1].id)
    const bday = computeEvents([entry('a', '2026-03-02', "!\"Sam's birthday\""), entry('b', '2027-03-02', "!\"Sam's birthday\"")])
    expect(bday.map((e) => e.first)).toEqual(['2026-03-02', '2027-03-02'])
  })

  it('counts an entry once per title, uses the earliest spelling, lets an entry be in several events, skips deleted ones', () => {
    const events = computeEvents([
      entry('b', '2026-06-02', '!"my PARTY"'),
      entry('a', '2026-06-01', '!"My Party" and again !"my party", then !"Two"'),
      entry('x', '2026-06-01', '!"Gone"', 1),
      entry('y', '2026-06-01', 'nothing here #tag'),
    ])
    expect(events.map((e) => [e.title, e.count, e.entryIds])).toEqual([['My Party', 2, ['a', 'b']], ['Two', 1, ['a']]])
  })

  it('an own date: the same title and date is one event however far apart; another date is another event', () => {
    const one = computeEvents([
      entry('a', '2026-05-13', 'Back from !"Lisbon trip" (2026-05-12)'),
      entry('b', '2026-07-30', 'Found photos of the !"lisbon TRIP" (2026-05-12)'),
    ])
    expect(one).toHaveLength(1)
    expect(one[0]).toMatchObject({ title: 'Lisbon trip', date: '2026-05-12', first: '2026-05-12', last: '2026-05-12', count: 2 })
    const two = computeEvents([entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)'), entry('b', '2026-05-13', '!"Trip" (2026-05-13)')])
    expect(two.map((e) => [e.date, e.entryIds]).sort()).toEqual([['2026-05-12', ['a']], ['2026-05-13', ['b']], ['2026-05-20', ['a']]])
    expect(new Set(two.map((e) => e.id)).size).toBe(3)
    expect('date' in computeEvents([entry('a', '2026-05-01', '!"Trip"')])[0]).toBe(false)
  })

  it('a marker without a date joins the nearest dated event within 7 days, or else is its own event', () => {
    const near = computeEvents([
      entry('a', '2026-05-12', '!"Lisbon trip" (2026-05-12)'),
      entry('b', '2026-05-19', 'More of the !"Lisbon trip"'), // 7 days after the date: joins
      entry('c', '2026-05-09', 'Packing for !"lisbon trip"'), // 3 days before: joins
      entry('d', '2026-05-20', 'Later !"Lisbon trip"'), // 8 days: its own event
      entry('e', '2026-05-12', '!"Lisbon trip" (2026-05-12) and again !"Lisbon trip"'), // counted once, in the dated one
    ])
    expect(near.map((e) => [e.date, e.entryIds])).toEqual([['2026-05-12', ['c', 'a', 'e', 'b']], [undefined, ['d']]])
    const nearest = computeEvents([
      entry('a', '2026-05-01', '!"Trip" (2026-05-01)'),
      entry('b', '2026-05-12', '!"Trip" (2026-05-12)'),
      entry('c', '2026-05-09', 'Packing for the !"Trip"'), // 8 days from the first date, 3 from the second
    ])
    expect(nearest.map((e) => [e.date, e.entryIds])).toEqual([['2026-05-01', ['a']], ['2026-05-12', ['c', 'b']]])
  })

  it('finds the event a marker belongs to', () => {
    const entries = [
      entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)'),
      entry('b', '2026-05-14', 'Later on the !"Trip"'),
    ]
    const events = computeEvents(entries)
    expect(eventOfMarker(events, 'a', 'trip', '2026-05-20')?.date).toBe('2026-05-20')
    expect(eventOfMarker(events, 'b', 'Trip')?.date).toBe('2026-05-12') // the event its entry joined
    expect(eventOfMarker(events, 'a', 'Trip')?.date).toBe('2026-05-12') // the first of several
    expect(eventOfMarker(events, 'a', 'Other')).toBeUndefined()
  })
})

describe('after a rename', () => {
  it('finds the renamed event with a new id, also the right one of two dated events', () => {
    const entries = [entry('a', '2026-05-01', '!"Trip"'), entry('b', '2026-05-03', '!"Trip" again'), entry('z', '2026-05-02', '!"Other"')]
    const before = computeEvents(entries).find((e) => e.key === 'trip')!
    const after = eventAfterRename(entries, before, 'Road trip')!
    expect(after).toMatchObject({ key: 'road trip', title: 'Road trip', entryIds: ['a', 'b'] })
    expect(after.id).not.toBe(before.id)
    const two = [entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)')]
    const second = computeEvents(two).find((e) => e.date === '2026-05-20')!
    expect(eventAfterRename(two, second, 'Road trip')).toMatchObject({ title: 'Road trip', date: '2026-05-20' })
  })

  it('joins a neighbor that has the new title, unless it is more than 7 days away (what a merge warns about)', () => {
    const close = [entry('n', '2026-05-01', '!"Weekend away"'), entry('t', '2026-05-04', '!"Wekend away"')]
    const typo = computeEvents(close).find((e) => e.key === 'wekend away')!
    expect(eventAfterRename(close, typo, 'Weekend away')).toMatchObject({ entryIds: ['n', 't'], first: '2026-05-01' })
    const far = [entry('n', '2026-05-01', '!"Weekend away"'), entry('t', '2026-05-20', '!"Wekend away"')]
    const farTypo = computeEvents(far).find((e) => e.key === 'wekend away')!
    expect(eventAfterRename(far, farTypo, 'Weekend away')).toMatchObject({ entryIds: ['t'], title: 'Weekend away' })
  })
})

it('events survive the Markdown day file unchanged', () => {
  const e = entry('a', '2026-04-04', 'Party at !"Jack\'s 40th" (2026-04-03) with @sam')
  const back = parseDay(serializeDay(e.day, [e]), e.day)
  expect(back.map((x) => x.text)).toEqual([e.text])
  expect(computeEvents(back).map((x) => [x.title, x.date])).toEqual([["Jack's 40th", '2026-04-03']])
})
