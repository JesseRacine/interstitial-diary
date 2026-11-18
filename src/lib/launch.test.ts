import { expect, it } from 'vitest'
import { MAX_SHARED, cleanLaunchUrl, parseLaunch } from './launch'

it('parseLaunch: ?new=1 or shared text opens the entry box; title, text and link on their own lines, no repeats', () => {
  expect(parseLaunch('?view=photos')).toEqual({ newEntry: false, text: '' })
  expect(parseLaunch('?new=1')).toEqual({ newEntry: true, text: '' })
  expect(parseLaunch('?text=Lunch%20with%20Sam%20%23fun')).toEqual({ newEntry: true, text: 'Lunch with Sam #fun' })
  expect(parseLaunch('?new=1&title=A%20page&text=Worth%20reading&url=https%3A%2F%2Fexample.com%2Fp').text)
    .toBe('A page\nWorth reading\nhttps://example.com/p')
  const link = 'https://example.com/p' // Android repeats the link inside the text
  expect(parseLaunch(`?title=A%20page&text=${encodeURIComponent(`A page ${link}`)}&url=${encodeURIComponent(link)}`).text).toBe(`A page ${link}`)
  expect(parseLaunch(`?text=${'x'.repeat(MAX_SHARED + 500)}`).text).toHaveLength(MAX_SHARED)
  expect(parseLaunch('?text=%20%20%0A')).toEqual({ newEntry: false, text: '' })
})

it('cleanLaunchUrl removes only the launch words, keeping path, other words and #', () => {
  expect(cleanLaunchUrl('https://x.test/interstitial-diary/?new=1&text=hi&title=t&url=u&view=photos#top')).toBe('/interstitial-diary/?view=photos#top')
  expect(cleanLaunchUrl('https://x.test/?new=1')).toBe('/')
})
