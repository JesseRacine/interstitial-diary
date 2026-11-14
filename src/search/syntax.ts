/**
 * The search syntax as shown to people: the `?` help under the search bar and the Manual in Settings both render this
 * one table, so they cannot drift apart. Each row is [what to type, what it does]. Examples within a row are separated
 * by two spaces; syntax.test.ts runs every one through `parseQuery`, so a row that stops parsing fails a test.
 * (The parser itself is query.ts; the contract is DESIGN.md "Search".)
 */
export const SEARCH_SYNTAX: [string, string][] = [
  ['report draft', 'all of these words (also matches “drafting”, small typos)'],
  ['"email triage"', 'this exact phrase'],
  ['#work #tired', 'has both tags'],
  ['#work|#personal', 'has either tag'],
  ['@sarah  ~home', 'mentions a person / a place (names with spaces: @sarah_jones)'],
  ['@sarah|@tom  #work|~home', 'either one (#, @ and ~ can be mixed)'],
  ['-#personal  -@sarah  -meeting  -"a phrase"', 'leave out a tag, person, place, word or phrase'],
  ['on:2026-11-08', 'a specific day'],
  ['from:2026-11-01 to:2026-11-07', 'a date range (dates, months or years)'],
  ['in:2026-11  in:2026', 'a month or year'],
  ['today  yesterday  last:7d  last:3m', 'relative dates (d, w, m, y)'],
  ['time:09-12  after:22:00  before:7', 'time of day'],
  ['day:mon  day:weekend  day:mon,fri', 'day of the week'],
  ['has:image  -has:image', 'entries with photos / without photos (has:photo works too)'],
  ['event:"Jack\'s 40th"  event:party', 'entries that name this event (its whole title; capitals and spacing do not matter)'],
  ['has:event  -has:event', 'entries that name an event / that do not'],
]

/** The separate examples of one row. */
export const syntaxExamples = (row: string): string[] => row.split(/ {2,}/)
