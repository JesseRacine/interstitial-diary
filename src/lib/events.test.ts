import { describe, expect, it } from 'vitest'
import { blankEvents, computeEvents, eventAfterRename, eventKey, eventSegments, eventSpans, parseEventTitle, renameEventInText } from './events'
import { extractTags, makeEntry, replaceTag } from './entry'
import { parseDay, serializeDay } from './markdown'

const titles = (text: string) => eventSpans(text).map((s) => s.title)

/** An entry written at noon local time on a day, with an id. */
const entry = (id: string, day: string, text: string, deleted: 0 | 1 = 0) => {
  const [y, m, d] = day.split('-').map(Number)
  return { ...makeEntry(text, new Date(y, m - 1, d, 12).getTime(), id), deleted }
}

describe('reading events', () => {
  it('finds a quoted title after a !, with an apostrophe, straight or curly quotes', () => {
    expect(titles('Went to !"Jack\'s 40th birthday" tonight')).toEqual(["Jack's 40th birthday"])
    expect(titles('!“Beach weekend” was great')).toEqual(['Beach weekend'])
    expect(titles('first !"One" then !"Two"')).toEqual(['One', 'Two'])
  })
  it('accepts a marker at the start, after a newline or an opening bracket', () => {
    expect(titles('!"Start"')).toEqual(['Start'])
    expect(titles('x\n!"Next line"')).toEqual(['Next line'])
    expect(titles('(!"In brackets")')).toEqual(['In brackets'])
  })
  it('cleans the title: trims and collapses spaces', () => {
    expect(titles('!"  Jack\'s    party "')).toEqual(["Jack's party"])
  })
  it('does not take ordinary punctuation and quotes for an event', () => {
    expect(titles('he said "stop!" and "go"')).toEqual([])
    expect(titles('"What?!" she said, "no"')).toEqual([])
    expect(titles('wow!"x"')).toEqual([])
    expect(titles('!!"x"')).toEqual([])
    expect(titles('Great! "Quoted" words')).toEqual([])
    expect(titles('![alt](pic.png)')).toEqual([])
  })
  it('needs a quoted title: an unquoted word, an empty or blank title, a line break or a long title are not events', () => {
    expect(titles('!party')).toEqual([])
    expect(titles('!""')).toEqual([])
    expect(titles('!"   "')).toEqual([])
    expect(titles('!"two\nlines"')).toEqual([])
    expect(titles(`!"${'a'.repeat(121)}"`)).toEqual([])
    expect(titles(`!"${'a'.repeat(120)}"`)).toHaveLength(1)
  })
  it('cuts text into plain pieces and events that join back into the text', () => {
    const text = 'Went to !"Jack\'s party" with @sam, then !“Dinner” #food'
    const segs = eventSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.title).map((s) => [s.text, s.title])).toEqual([
      ['!"Jack\'s party"', "Jack's party"],
      ['!“Dinner”', 'Dinner'],
    ])
    expect(eventSegments('')).toEqual([])
    expect(eventSegments('plain')).toEqual([{ text: 'plain' }])
  })
  it('blanks markers without changing the length', () => {
    const text = 'a !"x #y" b'
    expect(blankEvents(text)).toBe('a ' + ' '.repeat(7) + ' b')
    expect(blankEvents(text)).toHaveLength(text.length)
    expect(blankEvents('no events')).toBe('no events')
  })
  it('treats case and spacing as the same title', () => {
    expect(eventKey("  Jack's   PARTY ")).toBe(eventKey("jack's party"))
  })
})

describe('events are not tags', () => {
  it('ignores tags inside a title but still reads tags outside it', () => {
    expect(extractTags('!"Jack\'s #party with @sam" #food @tom')).toEqual(['food', '@tom'])
  })
  it('leaves titles alone when a tag is renamed', () => {
    expect(replaceTag('#party !"My #party" #party', 'party', 'bash')).toBe('#bash !"My #party" #bash')
  })
})

describe('checking and renaming titles', () => {
  it('accepts a title and rejects empty ones, quote marks and long ones', () => {
    expect(parseEventTitle("  Jack's   40th ")).toEqual({ title: "Jack's 40th" })
    expect(parseEventTitle('   ')).toHaveProperty('error')
    expect(parseEventTitle('say "hi"')).toHaveProperty('error')
    expect(parseEventTitle('a'.repeat(121))).toHaveProperty('error')
  })
  it('gives every marker with that title a new one, keeping the quote marks and the rest of the text', () => {
    const text = 'Went to !"Jack\'s party" and then !“jack\'s   PARTY” ended; also !"Other" #x'
    expect(renameEventInText(text, eventKey("Jack's party"), 'Jack 40')).toBe('Went to !"Jack 40" and then !“Jack 40” ended; also !"Other" #x')
  })
  it('leaves the text alone when no marker has that title', () => {
    expect(renameEventInText('!"A" text', eventKey('B'), 'C')).toBe('!"A" text')
  })
})

describe('computing events', () => {
  it('lists one event per title, oldest first, with its dates and entries', () => {
    const events = computeEvents([
      entry('c', '2026-03-05', 'Back from !"Beach weekend"'),
      entry('a', '2026-02-01', 'Packing for !"Beach weekend"'),
      entry('b', '2026-01-10', "Party at !\"Jack's 40th\" tonight"),
    ])
    expect(events.map((e) => [e.title, e.count, e.first, e.last])).toEqual([
      ["Jack's 40th", 1, '2026-01-10', '2026-01-10'],
      ['Beach weekend', 1, '2026-02-01', '2026-02-01'],
      ['Beach weekend', 1, '2026-03-05', '2026-03-05'],
    ])
  })
  it('keeps entries within 7 days of each other in one event, and starts a new one after a longer gap', () => {
    const events = computeEvents([
      entry('a', '2026-05-01', '!"Trip"'),
      entry('b', '2026-05-08', '!"trip" day two'), // exactly 7 days after a: same event
      entry('c', '2026-05-15', '!"TRIP" day three'), // 7 days after b: still the same
      entry('d', '2026-05-23', '!"Trip"'), // 8 days after c: a new event
    ])
    expect(events).toHaveLength(2)
    expect(events[0]).toMatchObject({ title: 'Trip', count: 3, first: '2026-05-01', last: '2026-05-15', entryIds: ['a', 'b', 'c'] })
    expect(events[1]).toMatchObject({ title: 'Trip', count: 1, first: '2026-05-23', last: '2026-05-23' })
    expect(events[0].id).not.toBe(events[1].id)
  })
  it('separates the same birthday a year later without a year in the title', () => {
    const events = computeEvents([entry('a', '2026-03-02', "!\"Sam's birthday\""), entry('b', '2027-03-02', "!\"Sam's birthday\"")])
    expect(events.map((e) => e.first)).toEqual(['2026-03-02', '2027-03-02'])
  })
  it('counts an entry once per title, and uses the spelling of the earliest entry', () => {
    const events = computeEvents([entry('b', '2026-06-02', '!"my PARTY"'), entry('a', '2026-06-01', '!"My Party" and again !"my party"')])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'My Party', count: 2, entryIds: ['a', 'b'] })
  })
  it('lets one entry belong to several events', () => {
    const events = computeEvents([entry('a', '2026-06-01', '!"One" then !"Two"')])
    expect(events.map((e) => [e.title, e.entryIds])).toEqual([['One', ['a']], ['Two', ['a']]])
  })
  it('ignores deleted entries and entries without events', () => {
    expect(computeEvents([entry('a', '2026-06-01', '!"Gone"', 1), entry('b', '2026-06-01', 'nothing here #tag')])).toEqual([])
  })
})

describe('after a rename', () => {
  it('finds the renamed event, with its new id', () => {
    const entries = [entry('a', '2026-05-01', '!"Trip"'), entry('b', '2026-05-03', '!"Trip" again'), entry('z', '2026-05-02', '!"Other"')]
    const before = computeEvents(entries).find((e) => e.key === 'trip')!
    const after = eventAfterRename(entries, before, 'Road trip')!
    expect(after).toMatchObject({ key: 'road trip', title: 'Road trip', entryIds: ['a', 'b'] })
    expect(after.id).not.toBe(before.id)
  })
  it('joins a neighbouring event that already has the new title', () => {
    const entries = [entry('n', '2026-05-01', '!"Weekend away"'), entry('t', '2026-05-04', '!"Wekend away"')]
    const typo = computeEvents(entries).find((e) => e.key === 'wekend away')!
    const after = eventAfterRename(entries, typo, 'Weekend away')!
    expect(after.entryIds).toEqual(['n', 't'])
    expect(after.first).toBe('2026-05-01')
  })
  it('stays a separate event with the same title when the neighbour is more than 7 days away (what a merge warns about)', () => {
    const entries = [entry('n', '2026-05-01', '!"Weekend away"'), entry('t', '2026-05-20', '!"Wekend away"')]
    const typo = computeEvents(entries).find((e) => e.key === 'wekend away')!
    const target = computeEvents(entries).find((e) => e.key === 'weekend away')!
    const after = eventAfterRename(entries, typo, 'Weekend away')!
    expect(after.entryIds).toEqual(['t'])
    expect(after.entryIds.includes(target.entryIds[0])).toBe(false)
    expect(after.title).toBe('Weekend away')
  })
})

describe('events in day files', () => {
  it('survive the Markdown file unchanged', () => {
    const e = entry('a', '2026-04-04', 'Party at !"Jack\'s 40th" with @sam')
    const back = parseDay(serializeDay(e.day, [e]), e.day)
    expect(back).toHaveLength(1)
    expect(back[0].text).toBe(e.text)
    expect(computeEvents(back).map((x) => x.title)).toEqual(["Jack's 40th"])
  })
})
