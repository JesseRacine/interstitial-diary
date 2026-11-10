import { describe, expect, it } from 'vitest'
import { browserOnlyMode, browserOnlyWarning } from './dataSafety'

describe('browserOnlyMode', () => {
  it('no storage chosen: the data is only in this browser', () => expect(browserOnlyMode(null, false)).toBe('none'))
  it('"Files inside this browser" is not a backup either', () => expect(browserOnlyMode('browser', true)).toBe('inside-browser'))
  it('a storage outside the browser data is a copy, so no warning', () => expect(browserOnlyMode('folder', false)).toBeNull())
})

describe('browserOnlyWarning', () => {
  it('without photos it talks about entries only', () => {
    const w = browserOnlyWarning('none', 0)
    expect(w.title).toBe('Entries are only in this browser')
    expect(w.short).toBe('Only in this browser')
    expect(w.body).not.toMatch(/photo/i)
    expect(w.body).toMatch(/Choose a storage/)
  })

  it('with photos it says photos are only in this browser too, and how many', () => {
    const w = browserOnlyWarning('none', 12)
    expect(w.title).toBe('Entries and photos are only in this browser')
    expect(w.short).toBe('Photos only in this browser')
    expect(w.body).toContain('12 photos')
    expect(w.body).toMatch(/photos included/)
  })

  it('one photo is singular', () => {
    expect(browserOnlyWarning('none', 1).body).toContain('1 photo and')
    expect(browserOnlyWarning('none', 1).body).not.toContain('1 photos')
  })

  it('inside-browser storage says plainly that it is not a backup, with and without photos', () => {
    for (const photos of [0, 3]) {
      const w = browserOnlyWarning('inside-browser', photos)
      expect(w.body).toMatch(/not a backup/)
      expect(w.body).toMatch(/Export/)
      expect(w.body).not.toMatch(/Choose a storage/) // one is chosen already
    }
  })
})
