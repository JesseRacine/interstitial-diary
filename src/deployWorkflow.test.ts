import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The deploy workflow is plain YAML run by GitHub, so it can only be fully proven by a real run. These checks keep the
// parts that are easy to break by accident: the trigger, the tests-before-deploy order, the base path, the permissions.
const yml = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
const progress = readFileSync(new URL('../PROGRESS.md', import.meta.url), 'utf8')

describe('.github/workflows/deploy.yml', () => {
  it('deploys on a push to main and can be started by hand', () => {
    expect(yml).toMatch(/on:\s*\n\s+push:\s*\n\s+branches: \[main\]/)
    expect(yml).toContain('workflow_dispatch:')
  })

  it('runs the tests and the build before anything is uploaded', () => {
    const i = (s: string) => yml.indexOf(s)
    expect(i('npm ci')).toBeGreaterThan(-1)
    expect(i('npm ci')).toBeLessThan(i('npm test'))
    expect(i('npm test')).toBeLessThan(i('npm run build'))
    expect(i('npm run build')).toBeLessThan(i('actions/upload-pages-artifact'))
    expect(i('actions/upload-pages-artifact')).toBeLessThan(i('actions/deploy-pages'))
    expect(yml).toMatch(/deploy:\s*\n\s+needs: build/)
  })

  it('builds with the sub-path the site is served from', () => {
    expect(yml).toContain('BASE_PATH: /interstitial-diary/')
    // the address recorded in PROGRESS.md is the one this base path serves
    expect(progress).toContain('https://jesseracine.github.io/interstitial-diary/')
  })

  it('asks GitHub for only the permissions Pages needs, and never cancels a running deploy', () => {
    expect(yml).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+pages: write\s*\n\s+id-token: write/)
    expect(yml).toMatch(/concurrency:\s*\n\s+group: pages\s*\n\s+cancel-in-progress: false/)
  })

  it('pins every action to a major version and uses no unpinned or third-party action', () => {
    const uses = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1])
    expect(uses.length).toBeGreaterThanOrEqual(5)
    for (const u of uses) {
      expect(u, u).toMatch(/^actions\/[a-z-]+@v\d+$/)
    }
  })
})
