import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { normaliseBase } from '../base-path'

describe('normaliseBase (BASE_PATH setting)', () => {
  it('defaults to "/" when unset or empty, so dev and preview are unchanged', () => {
    expect(normaliseBase(undefined)).toBe('/')
    expect(normaliseBase('')).toBe('/')
    expect(normaliseBase('   ')).toBe('/')
    expect(normaliseBase('/')).toBe('/')
  })

  it('accepts a GitHub Pages project path in any spelling and returns /name/', () => {
    for (const v of ['/interstitial-diary/', '/interstitial-diary', 'interstitial-diary', 'interstitial-diary/', ' /interstitial-diary/ ']) {
      expect(normaliseBase(v), v).toBe('/interstitial-diary/')
    }
  })

  it('keeps nested paths and collapses doubled slashes', () => {
    expect(normaliseBase('/a/b')).toBe('/a/b/')
    expect(normaliseBase('/a//b/')).toBe('/a/b/')
  })

  it('rejects a full URL, a query, a fragment, spaces, "." and ".." (a typo must fail the build)', () => {
    for (const v of ['https://jesseracine.github.io/interstitial-diary/', '//host/x', '/a?b=1', '/a#b', '/my repo/', '/a/../b', './', '/a\\b']) {
      expect(() => normaliseBase(v), v).toThrow()
    }
  })
})

describe('vite.config.ts', () => {
  const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
  it('takes the base path from BASE_PATH through normaliseBase', () => {
    expect(config).toContain('normaliseBase(process.env.BASE_PATH)')
    expect(config).toMatch(/base,/)
  })
})
