import { describe, expect, it } from 'vitest'
import { isEmptyQuery, parseQuery } from './query'
import { SEARCH_SYNTAX, syntaxExamples } from './syntax'

const NOW = new Date(2026, 10, 8, 12, 0)

describe('the search syntax shown in the help and the Manual', () => {
  it('every example parses without an error and does something', () => {
    for (const [row] of SEARCH_SYNTAX) {
      for (const example of [row, ...syntaxExamples(row)]) {
        const q = parseQuery(example, NOW)
        expect(q.errors, example).toEqual([])
        expect(isEmptyQuery(q), example).toBe(false)
      }
    }
  })

  it('has no repeated rows and a description for each', () => {
    expect(new Set(SEARCH_SYNTAX.map(([q]) => q)).size).toBe(SEARCH_SYNTAX.length)
    expect(SEARCH_SYNTAX.every(([, d]) => d.length > 5)).toBe(true)
  })
})
