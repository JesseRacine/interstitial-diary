import { describe, expect, it } from 'vitest'
import { viewFromAddress } from './startView'

describe('viewFromAddress', () => {
  it('opens the journal when there is no ?view=', () => {
    expect(viewFromAddress('')).toEqual({ view: 'journal', calMode: 'month' })
  })

  it('opens the named page', () => {
    expect(viewFromAddress('?view=photos').view).toBe('photos')
    expect(viewFromAddress('?view=tags').view).toBe('tags')
    expect(viewFromAddress('?view=settings').view).toBe('settings')
    expect(viewFromAddress('?view=calendar')).toEqual({ view: 'calendar', calMode: 'month' })
  })

  it('opens Calendar > Events for the old Events tab address', () => {
    expect(viewFromAddress('?view=events')).toEqual({ view: 'calendar', calMode: 'events' })
  })

  it('opens the journal for a word it does not know', () => {
    expect(viewFromAddress('?view=nonsense').view).toBe('journal')
    expect(viewFromAddress('?view=').view).toBe('journal')
  })
})
