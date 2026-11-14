import { describe, expect, it } from 'vitest'
import { isEmptyQuery, parseQuery, toggleToken, tokenize } from './query'

const NOW = new Date(2026, 10, 8, 12, 0) // Sun 8 Nov 2026
const p = (s: string) => parseQuery(s, NOW)

describe('tokenize', () => {
  it('keeps quoted phrases together', () => {
    expect(tokenize('a "b c" -"d e" f')).toEqual(['a', '"b c"', '-"d e"', 'f'])
  })
})

describe('tokenize with a quoted filter value', () => {
  it('keeps event:"a title" together, with straight or curly quotes', () => {
    expect(tokenize(`a event:"Jack's 40th" -has:image b`)).toEqual(['a', `event:"Jack's 40th"`, '-has:image', 'b'])
    expect(tokenize('event:“Lisbon trip” x')).toEqual(['event:“Lisbon trip”', 'x'])
  })
  it('leaves other words and phrases as before', () => {
    expect(tokenize('on:2026-11-08 "a b" c:d')).toEqual(['on:2026-11-08', '"a b"', 'c:d'])
  })
})

describe('event filters', () => {
  it('event:"title" needs the whole title, ignoring capitals and spacing', () => {
    expect(p(`event:"Jack's 40th birthday"`).events).toEqual(["jack's 40th birthday"])
    expect(p('Event:"Lisbon   TRIP"').events).toEqual(['lisbon trip'])
    expect(p('event:“Jack’s party”').events).toEqual(['jack’s party'])
  })
  it('quotes are optional for a one-word title', () => expect(p('event:party').events).toEqual(['party']))
  it('several events are all required, and combine with other words and filters', () => {
    const q = p('lunch event:"Lisbon trip" with #work event:party in:2026')
    expect(q.events).toEqual(['lisbon trip', 'party'])
    expect(q.terms).toEqual(['lunch', 'with'])
    expect(q.tags).toEqual(['work'])
    expect(q.from).toBe('2026-01-01')
    expect(q.errors).toEqual([])
  })
  it('an empty title is reported', () => {
    const q = p('event:""')
    expect(q.events).toEqual([])
    expect(q.errors).toHaveLength(1)
  })
  it('has:event and -has:event', () => {
    expect(p('has:event').hasEvent).toBe(true)
    expect(p('HAS:Events').hasEvent).toBe(true)
    expect(p('-has:event').hasEvent).toBe(false)
    expect(p('tired').hasEvent).toBeUndefined()
    expect(p('has:event').errors).toEqual([])
  })
  it('both count as filters, so a query of only one of them is not empty', () => {
    expect(isEmptyQuery(p('has:event'))).toBe(false)
    expect(isEmptyQuery(p('-has:event'))).toBe(false)
    expect(isEmptyQuery(p('event:party'))).toBe(false)
    expect(isEmptyQuery(p(''))).toBe(true)
  })
  it('toggling a token works for them like for any other', () => {
    expect(toggleToken('tired', 'has:event')).toBe('tired has:event')
    expect(toggleToken('tired has:event', 'has:event')).toBe('tired')
    expect(toggleToken(`event:"a b" x`, `event:"a b"`)).toBe('x')
  })
})

describe('parseQuery', () => {
  it('keywords', () => expect(p('Report draft').terms).toEqual(['report', 'draft']))
  it('phrase', () => expect(p('"email triage"').phrases).toEqual(['email triage']))
  it('tags (all)', () => expect(p('#Work #tired').tags).toEqual(['work', 'tired']))
  it('tags (any)', () => expect(p('#work|#tired').anyTags).toEqual([['work', 'tired']]))
  it('exclude tag and word', () => {
    const q = p('-#personal -meeting -"stand up"')
    expect(q.excludeTags).toEqual(['personal'])
    expect(q.excludeTerms).toEqual(['meeting', 'stand up'])
  })
  it('people and places are stored keys with their symbol', () => {
    expect(p('@Sarah_Jones ~Home #work').tags).toEqual(['@sarah_jones', '~home', 'work'])
    expect(p('-@sarah -~home').excludeTags).toEqual(['@sarah', '~home'])
    expect(p('@sarah|@tom').anyTags).toEqual([['@sarah', '@tom']])
    expect(p('#work|~home|@tom').anyTags).toEqual([['work', '~home', '@tom']])
    expect(p('#a|b').anyTags).toEqual([['a', 'b']]) // a bare name in a group is still a plain tag
  })
  it('a symbol with no usable name is a word, not a tag', () => {
    const q = p('~5 @3pm @ ~ -~5')
    expect(q.tags).toEqual([])
    expect(q.terms).toEqual(['~5', '@3pm', '@', '~'])
    expect(q.excludeTerms).toEqual(['~5'])
  })
  it('a group with no usable tag is ignored', () => expect(isEmptyQuery(p('~5|@3pm'))).toBe(true))
  it('toggling a person token works like a tag chip', () => {
    expect(toggleToken('#work', '@sarah')).toBe('#work @sarah')
    expect(toggleToken('#work @Sarah', '@sarah')).toBe('#work')
  })
  it('on:', () => expect([p('on:2026-11-08').from, p('on:2026-11-08').to]).toEqual(['2026-11-08', '2026-11-08']))
  it('from/to', () => {
    const q = p('from:2026-11-01 to:2026-11-07')
    expect([q.from, q.to]).toEqual(['2026-11-01', '2026-11-07'])
  })
  it('to: with a month means end of month', () => expect(p('to:2026-02').to).toBe('2026-02-28'))
  it('in: month and year', () => {
    expect([p('in:2026-11').from, p('in:2026-11').to]).toEqual(['2026-11-01', '2026-11-30'])
    expect([p('in:2025').from, p('in:2025').to]).toEqual(['2025-01-01', '2025-12-31'])
  })
  it('today / yesterday', () => {
    expect([p('today').from, p('today').to]).toEqual(['2026-11-08', '2026-11-08'])
    expect([p('yesterday').from, p('yesterday').to]).toEqual(['2026-11-07', '2026-11-07'])
  })
  it('last:7d is the 7 days ending today', () => {
    expect([p('last:7d').from, p('last:7d').to]).toEqual(['2026-11-02', '2026-11-08'])
  })
  it('last:3m and last:1y', () => {
    expect(p('last:3m').from).toBe('2026-08-09')
    expect(p('last:1y').from).toBe('2025-11-09')
    expect(p('last:2w').from).toBe('2026-10-26')
  })
  it('time windows', () => {
    expect([p('time:09-12').timeFrom, p('time:09-12').timeTo]).toEqual([540, 720])
    expect([p('time:22-2').timeFrom, p('time:22-2').timeTo]).toEqual([1320, 120])
    expect([p('after:22:00').timeFrom, p('after:22:00').timeTo]).toEqual([1320, 1440])
    expect([p('before:7').timeFrom, p('before:7').timeTo]).toEqual([0, 420])
    expect([p('after:9 before:17').timeFrom, p('after:9 before:17').timeTo]).toEqual([540, 1020])
  })
  it('weekdays', () => {
    expect(p('day:mon').weekdays).toEqual([1])
    expect(p('day:weekend').weekdays).toEqual([0, 6])
    expect(p('day:monday,fri').weekdays).toEqual([1, 5])
  })
  it('has:image', () => {
    expect(p('has:image').hasImages).toBe(true)
    expect(p('has:photo').hasImages).toBe(true)
    expect(p('HAS:Photos').hasImages).toBe(true)
    expect(p('-has:image').hasImages).toBe(false)
    expect(p('tired').hasImages).toBeUndefined()
    expect(p('has:image').errors).toEqual([])
  })
  it('has:image counts as a filter, so a query of only it is not empty', () => {
    expect(isEmptyQuery(p('has:image'))).toBe(false)
    expect(isEmptyQuery(p('-has:image'))).toBe(false)
    expect(isEmptyQuery(p(''))).toBe(true)
  })
  it('reports an unknown has: value', () => {
    expect(p('has:video').errors).toHaveLength(1)
    expect(p('has:video').hasImages).toBeUndefined()
  })
  it('only has: can be negated as a filter; other -key:value stay excluded words', () => {
    const q = p('-on:2026-11-08')
    expect(q.excludeTerms).toEqual(['on:2026-11-08'])
    expect(q.from).toBeUndefined()
    expect(q.errors).toEqual([])
  })
  it('combination', () => {
    const q = p('#work tired time:13-17 last:30d')
    expect(q.tags).toEqual(['work'])
    expect(q.terms).toEqual(['tired'])
    expect([q.timeFrom, q.timeTo]).toEqual([780, 1020])
    expect([q.from, q.to]).toEqual(['2026-10-10', '2026-11-08'])
  })
  it('date filters intersect', () => {
    const q = p('in:2026-11 last:3d')
    expect([q.from, q.to]).toEqual(['2026-11-06', '2026-11-08'])
  })
  it('reports bad filters', () => {
    expect(p('on:tomorrow').errors).toHaveLength(1)
    expect(p('time:25-26').errors).toHaveLength(1)
    expect(p('day:funday').errors).toHaveLength(1)
  })
  it('leaves unknown colons as words', () => expect(p('note:thing').terms).toEqual(['note:thing']))
})

describe('toggleToken', () => {
  it('adds and removes', () => {
    expect(toggleToken('tired', 'last:7d')).toBe('tired last:7d')
    expect(toggleToken('tired last:7d', 'last:7d')).toBe('tired')
  })
})
