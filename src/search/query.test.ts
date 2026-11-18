import { expect, it } from 'vitest'
import { type ParsedQuery, isEmptyQuery, parseQuery, toggleToken, tokenize } from './query'

const NOW = new Date(2026, 10, 8, 12, 0) // Sun 8 Nov 2026
const p = (s: string) => parseQuery(s, NOW)

/** Each row: a query and the parts of the parsed result it must have. */
const check = (rows: [string, Partial<ParsedQuery>][]) => {
  for (const [q, want] of rows) expect(p(q), q).toMatchObject(want)
}

it('tokenize keeps quoted phrases and quoted filter values together', () => {
  expect(tokenize('a "b c" -"d e" f')).toEqual(['a', '"b c"', '-"d e"', 'f'])
  expect(tokenize(`a event:"Jack's 40th" -has:image b`)).toEqual(['a', `event:"Jack's 40th"`, '-has:image', 'b'])
  expect(tokenize('event:“Lisbon trip” x')).toEqual(['event:“Lisbon trip”', 'x'])
})

it('words, phrases, tags, people and places, and exclusions', () => {
  check([
    ['Report draft', { terms: ['report', 'draft'] }],
    ['"email triage"', { phrases: ['email triage'] }],
    ['#Work #tired', { tags: ['work', 'tired'] }],
    ['#work|#tired', { anyTags: [['work', 'tired']] }],
    ['-#personal -meeting -"stand up"', { excludeTags: ['personal'], excludeTerms: ['meeting', 'stand up'] }],
    ['@Sarah_Jones ~Home #work', { tags: ['@sarah_jones', '~home', 'work'] }],
    ['-@sarah -~home', { excludeTags: ['@sarah', '~home'] }],
    ['#work|~home|@tom', { anyTags: [['work', '~home', '@tom']] }],
    ['#a|b', { anyTags: [['a', 'b']] }], // a bare name in a group is still a plain tag
    ['~5 @3pm @ ~ -~5', { tags: [], terms: ['~5', '@3pm', '@', '~'], excludeTerms: ['~5'] }], // no usable name: a word
    ['-on:2026-11-08', { excludeTerms: ['on:2026-11-08'], errors: [] }], // only has: can be negated as a filter
    ['note:thing', { terms: ['note:thing'] }], // an unknown colon is a word
  ])
})

it('dates, times and weekdays', () => {
  check([
    ['on:2026-11-08', { from: '2026-11-08', to: '2026-11-08' }],
    ['from:2026-11-01 to:2026-11-07', { from: '2026-11-01', to: '2026-11-07' }],
    ['to:2026-02', { to: '2026-02-28' }],
    ['in:2026-11', { from: '2026-11-01', to: '2026-11-30' }],
    ['in:2025', { from: '2025-01-01', to: '2025-12-31' }],
    ['yesterday', { from: '2026-11-07', to: '2026-11-07' }],
    ['last:7d', { from: '2026-11-02', to: '2026-11-08' }],
    ['last:2w', { from: '2026-10-26' }],
    ['last:3m', { from: '2026-08-09' }],
    ['last:1y', { from: '2025-11-09' }],
    ['in:2026-11 last:3d', { from: '2026-11-06', to: '2026-11-08' }], // date filters intersect
    ['time:09-12', { timeFrom: 540, timeTo: 720 }],
    ['time:22-2', { timeFrom: 1320, timeTo: 120 }],
    ['after:9 before:17', { timeFrom: 540, timeTo: 1020 }],
    ['day:weekend', { weekdays: [0, 6] }],
    ['day:monday,fri', { weekdays: [1, 5] }],
    ['#work tired time:13-17 last:30d', { tags: ['work'], terms: ['tired'], timeFrom: 780, timeTo: 1020, from: '2026-10-10', to: '2026-11-08' }],
  ])
})

it('events and has: filters', () => {
  check([
    [`event:"Jack's 40th birthday"`, { events: ["jack's 40th birthday"] }],
    ['Event:"Lisbon   TRIP"', { events: ['lisbon trip'] }],
    ['event:party', { events: ['party'] }],
    ['lunch event:"Lisbon trip" #work event:party', { events: ['lisbon trip', 'party'], terms: ['lunch'], tags: ['work'], errors: [] }],
    ['HAS:Events', { hasEvent: true }],
    ['-has:event', { hasEvent: false }],
    ['HAS:Photos', { hasImages: true }],
    ['-has:image', { hasImages: false }],
  ])
  expect(p('tired').hasEvent).toBeUndefined()
  expect(p('tired').hasImages).toBeUndefined()
})

it('reports bad filters; a query of only a filter is not empty', () => {
  for (const q of ['on:tomorrow', 'time:25-26', 'day:funday', 'has:video', 'event:""']) expect(p(q).errors, q).toHaveLength(1)
  for (const q of ['has:event', '-has:image', 'event:party']) expect(isEmptyQuery(p(q)), q).toBe(false)
  expect(isEmptyQuery(p(''))).toBe(true)
  expect(isEmptyQuery(p('~5|@3pm'))).toBe(true) // a group with no usable tag is ignored
})

it('toggleToken adds and removes a token, any case', () => {
  expect(toggleToken('tired', 'last:7d')).toBe('tired last:7d')
  expect(toggleToken('tired last:7d', 'last:7d')).toBe('tired')
  expect(toggleToken('#work @Sarah', '@sarah')).toBe('#work')
  expect(toggleToken(`event:"a b" x`, `event:"a b"`)).toBe('x')
})
