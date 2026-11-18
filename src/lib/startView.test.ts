import { expect, it } from 'vitest'
import { viewFromAddress } from './startView'

it('?view= opens the named page, the old Events address opens Calendar > Events, anything else the journal', () => {
  expect(viewFromAddress('')).toEqual({ view: 'journal', calMode: 'month' })
  expect(viewFromAddress('?view=tracking').view).toBe('tracking')
  expect(viewFromAddress('?view=calendar')).toEqual({ view: 'calendar', calMode: 'month' })
  expect(viewFromAddress('?view=events')).toEqual({ view: 'calendar', calMode: 'events' })
  expect(viewFromAddress('?view=nonsense').view).toBe('journal')
})
