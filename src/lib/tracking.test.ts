import { describe, expect, it } from 'vitest'
import { extractTags, makeEntry, replaceTag, type ImageRef } from './entry'
import { computeEvents } from './events'
import { parseDay, serializeDay } from './markdown'
import {
  blankTracking, computeTracking, parseTrackingTitle, setTrackingState, splitTracking, trackingMarker, trackingNote, trackingSegments,
  trackingSpans,
} from './tracking'

const IMG: ImageRef = { hash: '3f9a2c1b7d04e8aa', ext: 'jpg', w: 640, h: 480 }
const IMG2: ImageRef = { hash: '9c01aa22f3b6d710', ext: 'png', w: 800, h: 600 }

/** An entry written at noon local time on a day, with an id. */
const entry = (id: string, day: string, text: string, deleted: 0 | 1 = 0, images?: ImageRef[]) => {
  const [y, m, d] = day.split('-').map(Number)
  return { ...makeEntry(text, new Date(y, m - 1, d, 12).getTime(), id, images), deleted }
}

describe('reading the marker', () => {
  it('finds quoted names after a + (with a state) and nothing else', () => {
    const rows: [string, [string, string][]][] = [
      ['+"Dyson V15 vacuum" $450 on Amazon', [['Dyson V15 vacuum', 'active']]],
      ['+“Dune: Part Three” on 18 Dec', [['Dune: Part Three', 'active']]],
      ["first +\"Sam's bike\" then +*\"Two\"", [["Sam's bike", 'active'], ['Two', 'starred']]],
      ['x\n+x"Next line"', [['Next line', 'done']]],
      ['(+X"In brackets")', [['In brackets', 'done']]],
      ['+*“A”', [['A', 'starred']]],
      ['+"x marks"', [['x marks', 'active']]], // a letter that starts the name is not a state
      ['+"  Dyson    V15 "', [['Dyson V15', 'active']]], // trimmed, spaces collapsed
      ...['C++"x"', '2 + "3" things', '+party', '1+"x"', '++"x"', '+1 "two"', '+xylophone "a"', '+""', '+"   "', '+"two\nlines"',
        `+"${'a'.repeat(121)}"`].map((t): [string, [string, string][]] => [t, []]),
    ]
    for (const [text, want] of rows) expect(trackingSpans(text).map((s) => [s.title, s.state]), text).toEqual(want)
    expect(trackingSpans(`+"${'a'.repeat(120)}"`)).toHaveLength(1)
    const text = 'a +*"Shoes" b'
    const [s] = trackingSpans(text)
    expect(text.slice(s.start, s.end)).toBe('+*"Shoes"')
    expect(text.slice(s.markEnd, s.quoteEnd)).toBe('"Shoes"')
  })

  it('a done marker may carry a real date in brackets right after it; anything else is plain text', () => {
    const t = '+x"Dyson" (2026-11-20) bought it'
    const [s] = trackingSpans(t)
    expect(s.date).toBe('2026-11-20')
    expect(t.slice(s.start, s.end)).toBe('+x"Dyson" (2026-11-20)')
    expect(trackingSpans('+x"Dyson"\t(2026-11-20)')[0].date).toBe('2026-11-20')
    for (const t2 of ['+x"A" (2026-02-30)', '+x"A" (12 May 2026)', '+x"A"\n(2026-05-12)', '+"A" (2026-05-12)', '+*"A" (2026-05-12)']) {
      expect(trackingSpans(t2)[0].date, t2).toBeUndefined()
    }
  })

  it('cuts text into pieces that join back exactly, and blanks a marker without changing the length', () => {
    const text = 'Saw +"Dyson V15" and +x"Old phone" (2026-01-02) too'
    const segs = trackingSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.filter((s) => s.title).map((s) => [s.title, s.state, s.date])).toEqual([
      ['Dyson V15', 'active', undefined],
      ['Old phone', 'done', '2026-01-02'],
    ])
    expect(trackingSegments('plain')).toEqual([{ text: 'plain' }])
    expect(blankTracking('a +x"Dyson" (2026-11-20) #b')).toBe('a ' + ' '.repeat(22) + ' #b')
  })
})

describe('writing the marker', () => {
  it('trackingMarker writes each state, and what it writes reads back', () => {
    expect(trackingMarker('Dyson V15')).toBe('+"Dyson V15"')
    expect(trackingMarker('Dyson V15', 'starred')).toBe('+*"Dyson V15"')
    expect(trackingMarker('Dyson V15', 'done', '2026-11-20')).toBe('+x"Dyson V15" (2026-11-20)')
    expect(trackingMarker('Dyson V15', 'active', '2026-11-20')).toBe('+"Dyson V15"') // only a done item has a date
    for (const state of ['active', 'starred', 'done'] as const) {
      expect(trackingSpans(`note ${trackingMarker("Sam's bike", state, '2026-11-20')} more`)[0]).toMatchObject({ title: "Sam's bike", state })
    }
  })

  it('parseTrackingTitle checks a typed name', () => {
    expect(parseTrackingTitle('  Dyson   V15 ')).toEqual({ title: 'Dyson V15' })
    expect(parseTrackingTitle("Sam's bike")).toEqual({ title: "Sam's bike" })
    for (const t of ['  ', 'say "hi"', 'a'.repeat(121)]) expect(parseTrackingTitle(t), t).toHaveProperty('error')
  })
})

describe('changing the state', () => {
  it('stars, finishes and restarts an item, changing only the marker and keeping every other character', () => {
    const text = 'Look at +"Dyson V15"  $450 on Amazon #shopping'
    const starred = setTrackingState(text, 'starred')
    expect(starred).toBe('Look at +*"Dyson V15"  $450 on Amazon #shopping')
    const done = setTrackingState(starred, 'done', '2026-11-20')
    expect(done).toBe('Look at +x"Dyson V15" (2026-11-20)  $450 on Amazon #shopping')
    expect(setTrackingState(done, 'active')).toBe(text) // back to exactly where it began
    expect(setTrackingState(done, 'starred')).toBe(starred)
    expect(setTrackingState('+“Dune:   Part Three” soon', 'starred')).toBe('+*“Dune:   Part Three” soon')
    const lines = 'Top\n+"Dyson V15"\nsecond line #a @sam ~home'
    expect(setTrackingState(lines, 'starred').replace('+*', '+')).toBe(lines)
  })

  it('writes a done date only when given, removes it when leaving done, and leaves other dates alone', () => {
    expect(setTrackingState('+"A" b', 'done')).toBe('+x"A" b')
    expect(setTrackingState('+x"A" (2026-11-20) b', 'active')).toBe('+"A" b')
    expect(setTrackingState('+x"A"\t(2026-11-20) b', 'starred')).toBe('+*"A" b')
    expect(setTrackingState('+"A" (2026-05-12) b', 'done', '2026-11-20')).toBe('+x"A" (2026-11-20) (2026-05-12) b')
    expect(setTrackingState('+x"A" (2026-02-30) b', 'active')).toBe('+"A" (2026-02-30) b')
  })

  it('changes only the first marker, and nothing when the state is already right or there is no marker', () => {
    expect(setTrackingState('+"One" and +"Two"', 'done')).toBe('+x"One" and +"Two"')
    const done = '+x"A" (2026-11-20)'
    expect(setTrackingState(done, 'done', '2026-12-31')).toBe(done) // the first date stays
    expect(setTrackingState('nothing here', 'done')).toBe('nothing here')
  })
})

it('the note is the text without the (first) marker', () => {
  expect(trackingNote('Saw this +"Dyson V15" yesterday')).toBe('Saw this yesterday')
  expect(trackingNote('Look:\n+"Dyson V15" $450')).toBe('Look:\n$450')
  expect(trackingNote('+x"Dyson V15" (2026-11-20) bought')).toBe('bought')
  expect(trackingNote('+"Dyson V15"')).toBe('')
  expect(trackingNote('+"One" then +"Two"')).toBe('then +"Two"')
})

describe('the Tracking list', () => {
  it('lists entries with a marker, oldest first, with state, note, first photo and done date', () => {
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
    expect(items[2].doneDate).toBe('2026-11-05')
  })

  it('skips deleted entries, counts an entry once by its first marker, and lists two entries of one name as two', () => {
    const items = computeTracking([
      entry('a', '2026-11-01', '+"Gone"', 1),
      entry('b', '2026-11-02', '+"First" and +x"Second"'),
      entry('c', '2026-11-03', '+"Lamp"'),
      entry('d', '2026-11-04', '+"Lamp"'),
    ])
    expect(items.map((i) => i.title)).toEqual(['First', 'Lamp', 'Lamp'])
  })

  it('sorts active items (starred on top) and done items (by the day marked done)', () => {
    const items = computeTracking([
      entry('a', '2026-11-01', '+"banana stand"'),
      entry('b', '2026-11-02', '+"Cherry"'),
      entry('c', '2026-11-03', '+*"Apple"'),
      entry('d', '2026-11-04', '+x"Done early" (2026-11-06)'),
      entry('e', '2026-11-05', '+x"Done late" (2026-11-09)'),
      entry('f', '2026-11-06', '+x"No date"'), // falls back to the day written (6 Nov); its entry is newer than "Done early"
      entry('g', '2026-11-07', '+*"zed"'),
    ])
    const names = (list: { title: string }[]) => list.map((i) => i.title)
    expect(names(splitTracking(items).active)).toEqual(['zed', 'Apple', 'Cherry', 'banana stand'])
    expect(names(splitTracking(items, 'oldest').active)).toEqual(['Apple', 'zed', 'banana stand', 'Cherry'])
    expect(names(splitTracking(items, 'name').active)).toEqual(['Apple', 'zed', 'banana stand', 'Cherry'])
    expect(names(splitTracking(items).done)).toEqual(['Done late', 'No date', 'Done early'])
    expect(names(splitTracking(items, 'oldest').done)).toEqual(['Done early', 'No date', 'Done late'])
    const same = computeTracking([entry('b', '2026-11-01', '+"B"'), entry('a', '2026-11-01', '+"A"')])
    expect(names(splitTracking(same).active)).toEqual(names(splitTracking([...same].reverse()).active))
  })
})

describe('a name is not read as anything else', () => {
  it('tags inside a name are not tags, and renaming a tag leaves names (and event titles) alone', () => {
    expect(extractTags('+"Dyson #a for @sam" ~shop')).toEqual(['~shop'])
    expect(extractTags('+x"Dyson" (2026-11-20) #shopping')).toEqual(['shopping'])
    expect(replaceTag('+"My #shopping" #shopping', 'shopping', 'buy')).toBe('+"My #shopping" #buy')
    expect(replaceTag('!"Trip #a" #a +"Bag #a" #a', 'a', 'b')).toBe('!"Trip #a" #b +"Bag #a" #b')
  })

  it('a tracked item is not an event, and an event is not a tracked item', () => {
    expect(trackingSpans('!"Jack\'s 40th"')).toEqual([])
    const both = entry('b', '2026-11-01', '!"Jack\'s 40th" and +"Gift idea"')
    expect(computeEvents([both]).map((e) => e.title)).toEqual(["Jack's 40th"])
    expect(computeTracking([both]).map((i) => i.title)).toEqual(['Gift idea'])
  })
})

it('the Markdown day file keeps every state, a marker that starts a line, and the photo, exactly as typed', () => {
  const entries = [
    entry('a', '2026-11-08', '+"Dyson V15" $450 on Amazon', 0, [IMG]),
    entry('b', '2026-11-08', '+*“Dune: Part Three” Dec 18 #movies'),
    entry('c', '2026-11-08', '+x"Old phone" (2026-11-08) sold it'),
    entry('d', '2026-11-08', '+"Lamp"'),
  ].map((e, i) => ({ ...e, createdAt: e.createdAt + i * 60_000 }))
  const back = parseDay(serializeDay('2026-11-08', entries), '2026-11-08')
  expect(back.map((e) => e.text)).toEqual(entries.map((e) => e.text))
  expect(computeTracking(back).map((i) => [i.title, i.state])).toEqual([
    ['Dyson V15', 'active'], ['Dune: Part Three', 'starred'], ['Old phone', 'done'], ['Lamp', 'active'],
  ])
  expect(computeTracking(back)[0].image).toEqual(IMG)
})
