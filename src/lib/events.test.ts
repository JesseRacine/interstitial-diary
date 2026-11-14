import { describe, expect, it } from 'vitest'
import { blankEvents, computeEvents, eventAfterRename, eventKey, eventOfMarker, eventSegments, eventSpans, parseEventTitle, renameEventInText } from './events'
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

describe('an event’s own date', () => {
  const dates = (text: string) => eventSpans(text).map((s) => [s.title, s.date])

  it('reads (YYYY-MM-DD) right after the marker, with or without a space', () => {
    expect(dates(`Great night at !"Jack's 40th" (2026-05-12) with @sam`)).toEqual([["Jack's 40th", '2026-05-12']])
    expect(dates('!"Trip"(2026-05-12)')).toEqual([['Trip', '2026-05-12']])
    expect(dates('!“Trip”   (2026-05-12) x')).toEqual([['Trip', '2026-05-12']])
    expect(dates('!"One" (2026-01-02) and !"Two"')).toEqual([['One', '2026-01-02'], ['Two', undefined]])
  })
  it('does not take other things for a date: not a real day, no brackets, not right after, another line', () => {
    expect(dates('!"Trip" (2026-02-30)')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip" (2026-13-01)')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip" 2026-05-12')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip" on (2026-05-12)')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip"\n(2026-05-12)')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip" (2026-5-12)')).toEqual([['Trip', undefined]])
    expect(dates('!"Trip" (12 May 2026)')).toEqual([['Trip', undefined]])
  })
  it('an unreadable date stays plain text after the marker', () => {
    const text = 'Went on !"Trip" (2026-02-30) today'
    expect(eventSegments(text).map((s) => s.text)).toEqual(['Went on ', '!"Trip"', ' (2026-02-30) today'])
  })
  it('the marker includes its date, so the pieces still join back into the text', () => {
    const text = 'a !"Trip" (2026-05-12) b !"Other" c'
    const segs = eventSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.title).map((s) => [s.text, s.title, s.date])).toEqual([
      ['!"Trip" (2026-05-12)', 'Trip', '2026-05-12'],
      ['!"Other"', 'Other', undefined],
    ])
  })
  it('is blanked with the marker, so nothing inside it is read as a tag', () => {
    const text = 'a !"x" (2026-05-12) #y'
    expect(blankEvents(text)).toBe('a ' + ' '.repeat(19 - 2) + ' #y')
    expect(extractTags(text)).toEqual(['y'])
  })
  it('stays when the title is renamed', () => {
    const text = 'Went on !"Trip" (2026-05-12) and !“trip” again, !"Other" (2026-01-01)'
    expect(renameEventInText(text, eventKey('Trip'), 'Road trip')).toBe('Went on !"Road trip" (2026-05-12) and !“Road trip” again, !"Other" (2026-01-01)')
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

describe('computing events with their own date', () => {
  it('the same title and date is one event however far apart the entries were written; its day is that date', () => {
    const events = computeEvents([
      entry('a', '2026-05-13', 'Back from !"Lisbon trip" (2026-05-12)'),
      entry('b', '2026-07-30', 'Found photos of the !"Lisbon trip" (2026-05-12)'),
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ title: 'Lisbon trip', date: '2026-05-12', first: '2026-05-12', last: '2026-05-12', count: 2, entryIds: ['a', 'b'] })
  })
  it('the same title on different dates is two events, even a few days apart', () => {
    const events = computeEvents([
      entry('a', '2026-05-12', '!"Standup" (2026-05-12)'),
      entry('b', '2026-05-13', '!"Standup" (2026-05-13)'),
    ])
    expect(events.map((e) => [e.date, e.entryIds])).toEqual([['2026-05-12', ['a']], ['2026-05-13', ['b']]])
    expect(events[0].id).not.toBe(events[1].id)
  })
  it('one entry can name the same title on two dates: it is in both events, with different ids', () => {
    const events = computeEvents([entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)')])
    expect(events.map((e) => [e.date, e.entryIds])).toEqual([['2026-05-12', ['a']], ['2026-05-20', ['a']]])
    expect(new Set(events.map((e) => e.id)).size).toBe(2)
  })
  it('a marker without a date joins the dated event of that title written within 7 days of its date', () => {
    const events = computeEvents([
      entry('a', '2026-05-12', '!"Lisbon trip" (2026-05-12)'),
      entry('b', '2026-05-19', 'More of the !"Lisbon trip"'), // 7 days after the date: joins
      entry('c', '2026-05-09', 'Packing for !"lisbon trip"'), // 3 days before: joins
    ])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ date: '2026-05-12', first: '2026-05-12', last: '2026-05-12', count: 3, entryIds: ['c', 'a', 'b'] })
  })
  it('a marker without a date more than 7 days from the date is its own event, as before', () => {
    const events = computeEvents([
      entry('a', '2026-05-12', '!"Lisbon trip" (2026-05-12)'),
      entry('b', '2026-05-20', 'Later !"Lisbon trip"'), // 8 days: does not join
    ])
    expect(events.map((e) => [e.date, e.first, e.entryIds])).toEqual([['2026-05-12', '2026-05-12', ['a']], [undefined, '2026-05-20', ['b']]])
  })
  it('a marker without a date joins the nearest of two dated events', () => {
    const events = computeEvents([
      entry('a', '2026-05-01', '!"Trip" (2026-05-01)'),
      entry('b', '2026-05-12', '!"Trip" (2026-05-12)'),
      entry('c', '2026-05-09', 'Packing for the !"Trip"'), // 8 days from the first date, 3 from the second
    ])
    expect(events.map((e) => [e.date, e.entryIds])).toEqual([['2026-05-01', ['a']], ['2026-05-12', ['c', 'b']]])
  })
  it('an entry that names a dated event is not also counted in an undated one of the same title', () => {
    const events = computeEvents([entry('a', '2026-05-12', '!"Trip" (2026-05-12) and again !"Trip"')])
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ date: '2026-05-12', count: 1 })
  })
  it('uses the spelling of the earliest entry, and leaves undated events as they were', () => {
    const dated = computeEvents([entry('b', '2026-05-13', '!"my TRIP" (2026-05-12)'), entry('a', '2026-05-12', '!"My Trip" (2026-05-12)')])
    expect(dated[0].title).toBe('My Trip')
    const plain = computeEvents([entry('a', '2026-05-01', '!"Trip"')])
    expect(plain[0].date).toBeUndefined()
    expect('date' in plain[0]).toBe(false)
  })
})

describe('the event a marker belongs to', () => {
  const entries = [
    entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)'),
    entry('b', '2026-05-14', 'Later on the !"Trip"'),
    entry('z', '2026-05-30', 'Nothing here'),
  ]
  const events = computeEvents(entries)
  it('a marker with a date finds the event of that date', () => {
    expect(eventOfMarker(events, 'a', 'Trip', '2026-05-20')?.date).toBe('2026-05-20')
    expect(eventOfMarker(events, 'a', 'trip', '2026-05-12')?.date).toBe('2026-05-12')
  })
  it('a marker without a date finds the event its entry joined, and the first one when there are several', () => {
    expect(eventOfMarker(events, 'b', 'Trip')?.date).toBe('2026-05-12')
    expect(eventOfMarker(events, 'a', 'Trip')?.date).toBe('2026-05-12')
  })
  it('is undefined when the entry is in no such event', () => {
    expect(eventOfMarker(events, 'z', 'Trip')).toBeUndefined()
    expect(eventOfMarker(events, 'a', 'Other')).toBeUndefined()
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
  it('finds the right dated event when the entry names the title on two dates', () => {
    const entries = [entry('a', '2026-06-01', '!"Trip" (2026-05-12) and !"Trip" (2026-05-20)')]
    const second = computeEvents(entries).find((e) => e.date === '2026-05-20')!
    const after = eventAfterRename(entries, second, 'Road trip')!
    expect(after).toMatchObject({ title: 'Road trip', date: '2026-05-20' })
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
