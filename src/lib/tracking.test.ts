import { describe, expect, it } from 'vitest'
import { extractTags, makeEntry, replaceTag, type ImageRef } from './entry'
import { computeEvents } from './events'
import { parseDay, serializeDay } from './markdown'
import {
  blankTracking, computeTracking, parseTrackingTitle, setTrackingState, splitTracking, trackingMarker, trackingNote, trackingSegments,
  trackingSpans,
} from './tracking'

const titles = (text: string) => trackingSpans(text).map((s) => s.title)
const IMG: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
const IMG2: ImageRef = { hash: '9c01aa22f3b6d710', ext: 'png', w: 800, h: 600 }

/** An entry written at noon local time on a day, with an id. */
const entry = (id: string, day: string, text: string, deleted: 0 | 1 = 0, images?: ImageRef[]) => {
  const [y, m, d] = day.split('-').map(Number)
  return { ...makeEntry(text, new Date(y, m - 1, d, 12).getTime(), id, images), deleted }
}

describe('reading the marker', () => {
  it('finds a quoted name after a +, with an apostrophe, straight or curly quotes', () => {
    expect(titles('+"Dyson V15 vacuum" $450 on Amazon')).toEqual(['Dyson V15 vacuum'])
    expect(titles('+“Dune: Part Three” on 18 Dec')).toEqual(['Dune: Part Three'])
    expect(titles("+\"Sam's bike\"")).toEqual(["Sam's bike"])
    expect(titles('first +"One" then +"Two"')).toEqual(['One', 'Two'])
  })
  it('accepts a marker at the start, after a newline or an opening bracket', () => {
    expect(titles('+"Start"')).toEqual(['Start'])
    expect(titles('x\n+"Next line"')).toEqual(['Next line'])
    expect(titles('(+"In brackets")')).toEqual(['In brackets'])
  })
  it('cleans the name: trims and collapses spaces', () => {
    expect(titles('+"  Dyson    V15 "')).toEqual(['Dyson V15'])
  })
  it('does not take ordinary plus signs for a marker', () => {
    expect(titles('C++"x"')).toEqual([])
    expect(titles('2 + "3" things')).toEqual([])
    expect(titles('+party')).toEqual([])
    expect(titles('1+"x"')).toEqual([])
    expect(titles('++"x"')).toEqual([])
    expect(titles('+1 "two"')).toEqual([])
  })
  it('needs a name: an empty or blank name, a line break or a long name are not markers', () => {
    expect(titles('+""')).toEqual([])
    expect(titles('+"   "')).toEqual([])
    expect(titles('+"two\nlines"')).toEqual([])
    expect(titles(`+"${'a'.repeat(120)}"`)).toHaveLength(1)
    expect(titles(`+"${'a'.repeat(121)}"`)).toEqual([])
  })
  it('reads the three states', () => {
    expect(trackingSpans('+"A"')[0].state).toBe('active')
    expect(trackingSpans('+*"A"')[0].state).toBe('starred')
    expect(trackingSpans('+x"A"')[0].state).toBe('done')
    expect(trackingSpans('+X"A"')[0].state).toBe('done')
    expect(trackingSpans('+*“A”')[0].state).toBe('starred')
  })
  it('does not take a letter that starts the name for a state', () => {
    expect(trackingSpans('+"x marks"')[0]).toMatchObject({ state: 'active', title: 'x marks' })
    expect(trackingSpans('+xylophone "a"')).toEqual([])
  })
  it('gives every marker its place in the text', () => {
    const text = 'a +*"Shoes" b'
    const [s] = trackingSpans(text)
    expect(text.slice(s.start, s.end)).toBe('+*"Shoes"')
    expect(text.slice(s.markEnd, s.quoteEnd)).toBe('"Shoes"')
  })
})

describe('the done date', () => {
  it('belongs to a done marker, in brackets right after it', () => {
    const [s] = trackingSpans('+x"Dyson" (2026-11-20) bought it')
    expect(s.date).toBe('2026-11-20')
    expect('+x"Dyson" (2026-11-20) bought it'.slice(s.start, s.end)).toBe('+x"Dyson" (2026-11-20)')
    expect(trackingSpans('+x"Dyson"\t(2026-11-20)')[0].date).toBe('2026-11-20')
  })
  it('is plain text when it is not a real day, another format, after a line break or on another state', () => {
    expect(trackingSpans('+x"A" (2026-02-30)')[0].date).toBeUndefined()
    expect(trackingSpans('+x"A" (12 May 2026)')[0].date).toBeUndefined()
    expect(trackingSpans('+x"A"\n(2026-05-12)')[0].date).toBeUndefined()
    expect(trackingSpans('+"A" (2026-05-12)')[0].date).toBeUndefined()
    expect(trackingSpans('+*"A" (2026-05-12)')[0].date).toBeUndefined()
    const text = '+"A" (2026-05-12)'
    const [s] = trackingSpans(text)
    expect(text.slice(s.start, s.end)).toBe('+"A"')
  })
})

describe('segments and blanking', () => {
  it('cut the text into plain pieces and markers that join back', () => {
    const text = 'Saw +"Dyson V15" and +x"Old phone" (2026-01-02) too'
    const segs = trackingSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.title).map((s) => [s.title, s.state, s.date])).toEqual([
      ['Dyson V15', 'active', undefined],
      ['Old phone', 'done', '2026-01-02'],
    ])
    expect(trackingSegments('')).toEqual([])
    expect(trackingSegments('plain')).toEqual([{ text: 'plain' }])
  })
  it('blank a marker to spaces of the same length', () => {
    const text = 'a +x"Dyson" (2026-11-20) #b'
    expect(blankTracking(text)).toHaveLength(text.length)
    expect(blankTracking(text)).toBe('a ' + ' '.repeat(22) + ' #b')
    expect(blankTracking('no markers')).toBe('no markers')
  })
})

describe('writing the marker', () => {
  it('trackingMarker writes each state', () => {
    expect(trackingMarker('Dyson V15')).toBe('+"Dyson V15"')
    expect(trackingMarker('Dyson V15', 'starred')).toBe('+*"Dyson V15"')
    expect(trackingMarker('Dyson V15', 'done', '2026-11-20')).toBe('+x"Dyson V15" (2026-11-20)')
    expect(trackingMarker('Dyson V15', 'done')).toBe('+x"Dyson V15"')
    expect(trackingMarker('Dyson V15', 'active', '2026-11-20')).toBe('+"Dyson V15"') // only a done item has a date
  })
  it('what trackingMarker writes reads back', () => {
    for (const state of ['active', 'starred', 'done'] as const) {
      const [s] = trackingSpans(`note ${trackingMarker("Sam's bike", state, '2026-11-20')} more`)
      expect(s).toMatchObject({ title: "Sam's bike", state })
    }
  })
  it('parseTrackingTitle checks a typed name', () => {
    expect(parseTrackingTitle('  Dyson   V15 ')).toEqual({ title: 'Dyson V15' })
    expect(parseTrackingTitle('  ')).toHaveProperty('error')
    expect(parseTrackingTitle('say "hi"')).toHaveProperty('error')
    expect(parseTrackingTitle('a'.repeat(121))).toHaveProperty('error')
    expect(parseTrackingTitle("Sam's bike")).toEqual({ title: "Sam's bike" })
  })
})

describe('changing the state', () => {
  it('stars, finishes and restarts an item, changing only the marker', () => {
    const text = 'Look at +"Dyson V15"  $450 on Amazon #shopping'
    const starred = setTrackingState(text, 'starred')
    expect(starred).toBe('Look at +*"Dyson V15"  $450 on Amazon #shopping')
    const done = setTrackingState(starred, 'done', '2026-11-20')
    expect(done).toBe('Look at +x"Dyson V15" (2026-11-20)  $450 on Amazon #shopping')
    expect(setTrackingState(done, 'active')).toBe(text) // back to exactly where it began
    expect(setTrackingState(done, 'starred')).toBe(starred)
  })
  it('keeps the quote marks and spelling as typed', () => {
    expect(setTrackingState('+“Dune:   Part Three” soon', 'starred')).toBe('+*“Dune:   Part Three” soon')
  })
  it('writes no date when none is given, and removes the date when leaving done', () => {
    expect(setTrackingState('+"A" b', 'done')).toBe('+x"A" b')
    expect(setTrackingState('+x"A" (2026-11-20) b', 'active')).toBe('+"A" b')
    expect(setTrackingState('+x"A"\t(2026-11-20) b', 'starred')).toBe('+*"A" b')
  })
  it('leaves a date that is not a done date alone', () => {
    expect(setTrackingState('+"A" (2026-05-12) b', 'done', '2026-11-20')).toBe('+x"A" (2026-11-20) (2026-05-12) b')
    expect(setTrackingState('+x"A" (2026-02-30) b', 'active')).toBe('+"A" (2026-02-30) b')
  })
  it('changes only the first marker of an entry', () => {
    expect(setTrackingState('+"One" and +"Two"', 'done')).toBe('+x"One" and +"Two"')
  })
  it('returns the text unchanged for the state it already has, or when there is no marker', () => {
    const done = '+x"A" (2026-11-20)'
    expect(setTrackingState(done, 'done', '2026-12-31')).toBe(done) // the first date stays
    expect(setTrackingState('+"A"', 'active')).toBe('+"A"')
    expect(setTrackingState('nothing here', 'done')).toBe('nothing here')
  })
  it('keeps every other character, including line breaks and tags', () => {
    const text = 'Top\n+"Dyson V15"\nsecond line #a @sam ~home'
    expect(setTrackingState(text, 'starred').replace('+*', '+')).toBe(text)
  })
})

describe('the note', () => {
  it('is the text without the marker', () => {
    expect(trackingNote('+"Dyson V15" $450 on Amazon')).toBe('$450 on Amazon')
    expect(trackingNote('Saw this +"Dyson V15" yesterday')).toBe('Saw this yesterday')
    expect(trackingNote('Look:\n+"Dyson V15" $450')).toBe('Look:\n$450')
    expect(trackingNote('+x"Dyson V15" (2026-11-20) bought')).toBe('bought')
    expect(trackingNote('+"Dyson V15"')).toBe('')
    expect(trackingNote('no marker  ')).toBe('no marker')
  })
  it('keeps other markers in the text', () => {
    expect(trackingNote('+"One" then +"Two"')).toBe('then +"Two"')
  })
})

describe('computeTracking', () => {
  it('lists the entries that carry a marker, oldest first, with state, note and first photo', () => {
    const items = computeTracking([
      entry('b', '2026-11-02', '+*"Dune: Part Three" Dec 18'),
      entry('a', '2026-11-01', '+"Dyson V15" $450', 0, [IMG, IMG2]),
      entry('c', '2026-11-03', 'just a note'),
      entry('d', '2026-11-04', '+x"Old phone" (2026-11-05) sold it'),
    ])
    expect(items.map((i) => [i.id, i.title, i.state])).toEqual([
      ['a', 'Dyson V15', 'active'],
      ['b', 'Dune: Part Three', 'starred'],
      ['d', 'Old phone', 'done'],
    ])
    expect(items[0]).toMatchObject({ note: '$450', day: '2026-11-01', image: IMG })
    expect(items[1].image).toBeUndefined()
    expect(items[2].doneDate).toBe('2026-11-05')
  })
  it('ignores deleted entries and counts an entry once, by its first marker', () => {
    const items = computeTracking([
      entry('a', '2026-11-01', '+"Gone"', 1),
      entry('b', '2026-11-02', '+"First" and +x"Second"'),
    ])
    expect(items.map((i) => i.title)).toEqual(['First'])
  })
  it('lists two entries with the same name as two items', () => {
    const items = computeTracking([entry('a', '2026-11-01', '+"Lamp"'), entry('b', '2026-11-02', '+"Lamp"')])
    expect(items).toHaveLength(2)
  })
  it('is empty when nothing is tracked', () => {
    expect(computeTracking([])).toEqual([])
    expect(computeTracking([entry('a', '2026-11-01', 'plain')])).toEqual([])
  })
})

describe('splitTracking', () => {
  const items = computeTracking([
    entry('a', '2026-11-01', '+"Banana stand"'),
    entry('b', '2026-11-02', '+"Cherry"'),
    entry('c', '2026-11-03', '+*"Apple"'),
    entry('d', '2026-11-04', '+x"Done early" (2026-11-06)'),
    entry('e', '2026-11-05', '+x"Done late" (2026-11-09)'),
    entry('f', '2026-11-06', '+x"No date"'),
    entry('g', '2026-11-07', '+*"Zed"'),
  ])
  const names = (list: { title: string }[]) => list.map((i) => i.title)

  it('is newest first by default, with starred items on top', () => {
    expect(names(splitTracking(items).active)).toEqual(['Zed', 'Apple', 'Cherry', 'Banana stand'])
  })
  it('orders done items by the day they were marked done, or the day written when it is unknown', () => {
    // "No date" falls back to the day its entry was written (6 Nov), the same day as "Done early"; its entry is newer.
    expect(names(splitTracking(items).done)).toEqual(['Done late', 'No date', 'Done early'])
    expect(names(splitTracking(items, 'oldest').done)).toEqual(['Done early', 'No date', 'Done late'])
  })
  it('oldest first keeps starred items on top', () => {
    expect(names(splitTracking(items, 'oldest').active)).toEqual(['Apple', 'Zed', 'Banana stand', 'Cherry'])
  })
  it('A to Z ignores capitals and keeps starred items on top', () => {
    const mixed = computeTracking([entry('a', '2026-11-01', '+"banana"'), entry('b', '2026-11-02', '+"Apple"'), entry('c', '2026-11-03', '+*"zebra"')])
    expect(names(splitTracking(mixed, 'name').active)).toEqual(['zebra', 'Apple', 'banana'])
  })
  it('splits active from done', () => {
    const { active, done } = splitTracking(items)
    expect(active.every((i) => i.state !== 'done')).toBe(true)
    expect(done.every((i) => i.state === 'done')).toBe(true)
    expect(active.length + done.length).toBe(items.length)
  })
  it('is stable for items written in the same minute', () => {
    const same = computeTracking([entry('b', '2026-11-01', '+"B"'), entry('a', '2026-11-01', '+"A"')])
    expect(names(splitTracking(same).active)).toEqual(names(splitTracking([...same].reverse()).active))
  })
})

describe('a title is not read as anything else', () => {
  it('a #tag, @person or ~place inside a name is not a tag', () => {
    expect(extractTags('+"Dyson #a for @sam" ~shop')).toEqual(['~shop'])
    expect(extractTags('+"Dyson #a" and #real')).toEqual(['real'])
  })
  it('a tag next to the marker still is', () => {
    expect(extractTags('+"Dyson" #shopping')).toEqual(['shopping'])
    expect(extractTags('+x"Dyson" (2026-11-20) #shopping')).toEqual(['shopping'])
  })
  it('renaming a tag leaves names inside markers alone', () => {
    expect(replaceTag('+"Dyson #a" #a and #shopping', 'a', 'b')).toBe('+"Dyson #a" #b and #shopping')
    expect(replaceTag('+"My #shopping" #shopping', 'shopping', 'buy')).toBe('+"My #shopping" #buy')
  })
  it('renaming a tag still leaves event titles alone, and works when both kinds are in the text', () => {
    expect(replaceTag('!"Trip #a" #a +"Bag #a" #a', 'a', 'b')).toBe('!"Trip #a" #b +"Bag #a" #b')
  })
  it('a tracked item is not an event, and an event is not a tracked item', () => {
    expect(computeEvents([entry('a', '2026-11-01', '+"Dyson V15"')])).toEqual([])
    expect(trackingSpans('!"Jack\'s 40th"')).toEqual([])
    const both = entry('b', '2026-11-01', '!"Jack\'s 40th" and +"Gift idea"')
    expect(computeEvents([both]).map((e) => e.title)).toEqual(["Jack's 40th"])
    expect(computeTracking([both]).map((i) => i.title)).toEqual(['Gift idea'])
  })
})

describe('the Markdown file', () => {
  it('keeps every state exactly as typed', () => {
    const entries = [
      entry('a', '2026-11-08', '+"Dyson V15" $450 on Amazon'),
      entry('b', '2026-11-08', '+*“Dune: Part Three” Dec 18 #movies'),
      entry('c', '2026-11-08', '+x"Old phone" (2026-11-08) sold it'),
    ].map((e, i) => ({ ...e, createdAt: e.createdAt + i * 60_000 }))
    const back = parseDay(serializeDay('2026-11-08', entries), '2026-11-08')
    expect(back.map((e) => e.text)).toEqual(entries.map((e) => e.text))
    expect(computeTracking(back).map((i) => [i.title, i.state])).toEqual([
      ['Dyson V15', 'active'],
      ['Dune: Part Three', 'starred'],
      ['Old phone', 'done'],
    ])
  })
  it('keeps the photo of a tracked item', () => {
    const e = entry('a', '2026-11-08', '+"Dyson V15" $450', 0, [IMG])
    const back = parseDay(serializeDay('2026-11-08', [e]), '2026-11-08')
    expect(back[0].images).toEqual([IMG])
    expect(computeTracking(back)[0].image).toEqual(IMG)
  })
  it('keeps a marker that starts a line', () => {
    const e = entry('a', '2026-11-08', '+"Dyson V15"')
    const back = parseDay(serializeDay('2026-11-08', [e]), '2026-11-08')
    expect(back[0].text).toBe('+"Dyson V15"')
  })
})
