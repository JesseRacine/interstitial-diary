import { describe, expect, it } from 'vitest'
import { MAX_SHARED, cleanLaunchUrl, parseLaunch } from './launch'

describe('parseLaunch', () => {
  it('nothing special: not a new-entry launch', () => {
    expect(parseLaunch('')).toEqual({ newEntry: false, text: '' })
    expect(parseLaunch('?view=photos')).toEqual({ newEntry: false, text: '' })
  })

  it('?new=1 opens the entry box with nothing in it', () => {
    expect(parseLaunch('?new=1')).toEqual({ newEntry: true, text: '' })
    expect(parseLaunch('?new=0')).toEqual({ newEntry: false, text: '' })
  })

  it('shared text counts as a new entry by itself and is decoded', () => {
    expect(parseLaunch('?text=Lunch%20with%20Sam%20%23fun')).toEqual({ newEntry: true, text: 'Lunch with Sam #fun' })
    expect(parseLaunch('?new=1&text=a+b')).toEqual({ newEntry: true, text: 'a b' })
  })

  it('joins title, text and link on separate lines, skipping empty ones', () => {
    expect(parseLaunch('?new=1&title=A%20page&text=Worth%20reading&url=https%3A%2F%2Fexample.com%2Fp')).toEqual({
      newEntry: true,
      text: 'A page\nWorth reading\nhttps://example.com/p',
    })
    expect(parseLaunch('?new=1&title=&text=&url=https%3A%2F%2Fexample.com')).toEqual({ newEntry: true, text: 'https://example.com' })
  })

  it('drops a piece that another piece already contains (Android repeats the link)', () => {
    const link = 'https://example.com/p'
    const q = `?new=1&title=A%20page&text=${encodeURIComponent(`A page ${link}`)}&url=${encodeURIComponent(link)}`
    expect(parseLaunch(q).text).toBe(`A page ${link}`)
    expect(parseLaunch(`?text=${encodeURIComponent(link)}&url=${encodeURIComponent(link)}`).text).toBe(link)
  })

  it('cuts very long shared text', () => {
    const long = 'x'.repeat(MAX_SHARED + 500)
    expect(parseLaunch(`?text=${long}`).text).toHaveLength(MAX_SHARED)
  })

  it('whitespace only is nothing', () => {
    expect(parseLaunch('?text=%20%20%0A')).toEqual({ newEntry: false, text: '' })
  })
})

describe('cleanLaunchUrl', () => {
  it('removes only the launch words, keeping path, other words and #', () => {
    expect(cleanLaunchUrl('https://x.test/interstitial-diary/?new=1&text=hi&title=t&url=u&view=photos#top')).toBe('/interstitial-diary/?view=photos#top')
    expect(cleanLaunchUrl('https://x.test/?new=1')).toBe('/')
    expect(cleanLaunchUrl('https://x.test/app/')).toBe('/app/')
  })
})
