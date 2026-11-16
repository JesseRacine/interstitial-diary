import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { type SavedSiteDeps, dropSavedSiteAndReload, isNativeApp, removeSavedSite } from './nativeApp'

describe('isNativeApp', () => {
  it('is true for the Windows and Android apps (tauri.localhost) and the tauri:// scheme', () => {
    expect(isNativeApp({ hostname: 'tauri.localhost', protocol: 'https:' })).toBe(true)
    expect(isNativeApp({ hostname: 'tauri.localhost', protocol: 'http:' })).toBe(true)
    expect(isNativeApp({ hostname: 'localhost', protocol: 'tauri:' })).toBe(true)
  })

  it('is false for the website, the installed web app, the dev server and look-alikes', () => {
    expect(isNativeApp({ hostname: 'jesseracine.github.io', protocol: 'https:' })).toBe(false)
    expect(isNativeApp({ hostname: 'localhost', protocol: 'http:' })).toBe(false)
    expect(isNativeApp({ hostname: '127.0.0.1', protocol: 'http:' })).toBe(false)
    expect(isNativeApp({ hostname: 'tauri.localhost.evil.example', protocol: 'https:' })).toBe(false)
    expect(isNativeApp({ hostname: 'my-tauri.localhost', protocol: 'https:' })).toBe(false)
  })
})

/** A browser with these service workers and caches; records what was removed. */
function browser(workers: number, caches: string[], opts: { failUnregister?: boolean; failList?: boolean } = {}) {
  const log = { unregistered: 0, deleted: [] as string[] }
  const deps: SavedSiteDeps = {
    registrations: async () => {
      if (opts.failList) throw new Error('no service workers here')
      return Array.from({ length: workers }, () => ({
        unregister: async () => { if (opts.failUnregister) throw new Error('refused'); log.unregistered++; return true },
      }))
    },
    cacheNames: async () => caches,
    deleteCache: async (n) => { log.deleted.push(n); return true },
  }
  return { deps, log }
}

describe('removeSavedSite', () => {
  it('unregisters every service worker and deletes every cache, and says there was something', async () => {
    const { deps, log } = browser(2, ['workbox-precache-v2', 'runtime'])
    expect(await removeSavedSite(deps)).toBe(true)
    expect(log).toEqual({ unregistered: 2, deleted: ['workbox-precache-v2', 'runtime'] })
  })

  it('does nothing and says so when there is no saved copy', async () => {
    const { deps, log } = browser(0, [])
    expect(await removeSavedSite(deps)).toBe(false)
    expect(log).toEqual({ unregistered: 0, deleted: [] })
  })

  it('a refusal or a failure is skipped, not thrown, and the rest is still removed', async () => {
    const refused = browser(1, ['a'], { failUnregister: true })
    await expect(removeSavedSite(refused.deps)).resolves.toBe(true)
    expect(refused.log.deleted).toEqual(['a'])
    const failing = browser(0, ['a'], { failList: true })
    await expect(removeSavedSite(failing.deps)).resolves.toBe(true)
  })
})

describe('dropSavedSiteAndReload (at startup in the native apps)', () => {
  const flag = () => {
    const data = new Map<string, string>()
    return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v) } }
  }

  it('removes an old saved copy and reloads the page once so the fresh files show', async () => {
    const { deps, log } = browser(1, ['old'])
    let reloads = 0
    await dropSavedSiteAndReload(() => { reloads++ }, flag(), deps)
    expect(log.unregistered).toBe(1)
    expect(reloads).toBe(1)
  })

  it('with no saved copy it does not reload (the normal start of a clean app)', async () => {
    const { deps } = browser(0, [])
    let reloads = 0
    await dropSavedSiteAndReload(() => { reloads++ }, flag(), deps)
    expect(reloads).toBe(0)
  })

  it('never reloads twice in one session, even if something keeps coming back', async () => {
    const { deps } = browser(1, ['again'])
    const f = flag()
    let reloads = 0
    await dropSavedSiteAndReload(() => { reloads++ }, f, deps)
    await dropSavedSiteAndReload(() => { reloads++ }, f, deps)
    expect(reloads).toBe(1)
  })

  it('never throws, whatever goes wrong', async () => {
    const { deps } = browser(1, ['x'])
    await expect(dropSavedSiteAndReload(() => { throw new Error('cannot reload') }, flag(), deps)).resolves.toBeUndefined()
  })
})

describe('the app uses it', () => {
  it('UpdatePrompt skips registering the service worker in the native apps and cleans up instead', () => {
    const src = readFileSync(new URL('../components/UpdatePrompt.tsx', import.meta.url), 'utf8')
    const native = src.indexOf('isNativeApp(location)')
    const register = src.indexOf('registerSW({')
    expect(native).toBeGreaterThan(-1)
    expect(src).toContain('dropSavedSiteAndReload()')
    expect(native).toBeLessThan(register) // the check comes first, and returns before registering
    expect(src.slice(native, register)).toContain('return')
  })
})
