import { expect, it } from 'vitest'
import { showGapsFromStored, showGapsToStored } from './prefs'

it('the time between entries is shown unless it was turned off', () => {
  expect(showGapsFromStored(null)).toBe(true) // never set
  expect(showGapsFromStored('1')).toBe(true)
  expect(showGapsFromStored('0')).toBe(false)
  expect(showGapsFromStored('')).toBe(true) // anything unexpected leaves the feature on
  expect([true, false].map((on) => showGapsFromStored(showGapsToStored(on)))).toEqual([true, false])
})
