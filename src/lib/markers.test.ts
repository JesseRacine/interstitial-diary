import { describe, expect, it } from 'vitest'
import { markerSegments } from './markers'
import { trackingEntryText } from './tracking'

describe('markerSegments', () => {
  it('cuts plain text, an event and a tracking marker in order, and joins back', () => {
    const text = 'Went to !"Jack\'s 40th" and saw +*"Dyson V15" for $450'
    const segs = markerSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs.map((s) => s.kind)).toEqual([undefined, 'event', undefined, 'tracking', undefined])
    expect(segs[3]).toMatchObject({ kind: 'tracking', title: 'Dyson V15', state: 'starred' })
    expect(segs[1]).toMatchObject({ kind: 'event', title: "Jack's 40th" })
  })

  it('carries the date of an event and of a done item', () => {
    const segs = markerSegments('!"Trip" (2026-05-12) and +x"Phone" (2026-11-10)')
    expect(segs[0]).toMatchObject({ kind: 'event', date: '2026-05-12' })
    expect(segs[2]).toMatchObject({ kind: 'tracking', state: 'done', date: '2026-11-10' })
  })

  it('makes a chip of the first tracking marker only', () => {
    const segs = markerSegments('+"One" and +"Two"')
    expect(segs.filter((s) => s.kind === 'tracking').map((s) => (s as { title: string }).title)).toEqual(['One'])
    expect(segs.map((s) => s.text).join('')).toBe('+"One" and +"Two"')
  })

  it('is plain text when there is no marker, and empty for no text', () => {
    expect(markerSegments('just a note')).toEqual([{ text: 'just a note' }])
    expect(markerSegments('')).toEqual([])
    expect(markerSegments('C++"x" and 2 + "3"')).toEqual([{ text: 'C++"x" and 2 + "3"' }])
  })

  it('lets the earlier of two overlapping markers win and still joins back', () => {
    const text = '+"A !"B" C"'
    const segs = markerSegments(text)
    expect(segs.map((s) => s.text).join('')).toBe(text)
    expect(segs[0]).toMatchObject({ kind: 'tracking', title: 'A !' })
  })
})

describe('trackingEntryText', () => {
  it('writes the marker and the note', () => {
    expect(trackingEntryText('Dyson V15', '$450 on Amazon')).toBe('+"Dyson V15" $450 on Amazon')
    expect(trackingEntryText('Dyson V15', '  $450\nwait for a sale  ')).toBe('+"Dyson V15" $450\nwait for a sale')
  })
  it('is just the marker without a note, and reads back as an item', () => {
    expect(trackingEntryText('Standing desk', '')).toBe('+"Standing desk"')
    expect(trackingEntryText('Standing desk', '   ')).toBe('+"Standing desk"')
    expect(markerSegments(trackingEntryText("Sam's bike", 'red'))[0]).toMatchObject({ kind: 'tracking', title: "Sam's bike", state: 'active' })
  })
})
