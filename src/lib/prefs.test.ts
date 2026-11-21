import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { TEXT_SIZES, applyTextSize, showGapsFromStored, showGapsToStored, textSizeFromStored } from './prefs'

it('the time between entries is shown unless it was turned off', () => {
  expect(showGapsFromStored(null)).toBe(true) // never set
  expect(showGapsFromStored('1')).toBe(true)
  expect(showGapsFromStored('0')).toBe(false)
  expect(showGapsFromStored('')).toBe(true) // anything unexpected leaves the feature on
  expect([true, false].map((on) => showGapsFromStored(showGapsToStored(on)))).toEqual([true, false])
})

describe('text size', () => {
  it('is normal unless a known size was saved', () => {
    expect(textSizeFromStored(null)).toBe('normal') // never set
    expect(textSizeFromStored('')).toBe('normal')
    expect(textSizeFromStored('huge')).toBe('normal') // a value from another version
    for (const t of TEXT_SIZES) expect(textSizeFromStored(t.id)).toBe(t.id)
  })

  it('offers four sizes in growing order, with normal at exactly 100 percent', () => {
    expect(TEXT_SIZES.map((t) => t.id)).toEqual(['small', 'normal', 'large', 'xlarge'])
    const pct = TEXT_SIZES.map((t) => t.percent)
    expect([...pct].sort((a, b) => a - b)).toEqual(pct)
    expect(TEXT_SIZES.find((t) => t.id === 'normal')?.percent).toBe(100)
  })

  it("sets the page's root font size, and normal removes the setting so the browser's own default applies", () => {
    const root = { style: { fontSize: '' } }
    applyTextSize(root, 'large')
    expect(root.style.fontSize).toBe('115%')
    applyTextSize(root, 'small')
    expect(root.style.fontSize).toBe('90%')
    applyTextSize(root, 'normal')
    expect(root.style.fontSize).toBe('')
  })

  it('the stylesheet sizes the page text in rem, so the setting really scales it (a px size would ignore it)', () => {
    const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
    expect(css).toMatch(/body\s*\{[^}]*font:\s*1rem\//)
    expect(css).not.toMatch(/font-size:\s*[\d.]+px/)
  })

  it('is applied before the first paint, and by the setting', () => {
    expect(readFileSync(new URL('../main.tsx', import.meta.url), 'utf8')).toContain('applyTextSize(document.documentElement')
    const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
    expect(app).toContain('applyTextSize(document.documentElement, s)')
    expect(app).toContain('localStorage.setItem(TEXT_SIZE_KEY, s)')
  })
})
