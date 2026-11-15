import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BUILD_NUMBER } from './build'

describe('build number', () => {
  it('is a positive whole number', () => {
    expect(Number.isInteger(BUILD_NUMBER)).toBe(true)
    expect(BUILD_NUMBER).toBeGreaterThanOrEqual(1)
  })

  it('is one plain integer on one line, so it is easy to bump and to find', () => {
    const src = readFileSync(new URL('./build.ts', import.meta.url), 'utf8')
    expect(src.match(/^export const BUILD_NUMBER = \d+$/gm)).toHaveLength(1)
  })

  it('is shown in Settings', () => {
    const src = readFileSync(new URL('./components/SettingsView.tsx', import.meta.url), 'utf8')
    expect(src).toContain("from '../build'")
    expect(src).toContain('{BUILD_NUMBER}')
  })
})
