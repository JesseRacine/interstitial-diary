import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/*
 * public/sw-native.js runs inside the service worker. Here it is run against a stand-in for `self`, to check that it only
 * acts in the native apps and that, there, it takes over, deletes the saved copy, removes itself and reloads the window.
 */
const code = readFileSync(new URL('../public/sw-native.js', import.meta.url), 'utf8')

type Listener = (event: { waitUntil(p: Promise<unknown>): void }) => void

function run(location: { hostname: string; protocol: string }, opts: { failStep?: string } = {}) {
  const calls: string[] = []
  const listeners = new Map<string, Listener>()
  const fail = (step: string) => { if (opts.failStep === step) throw new Error(`${step} failed`) }
  const self = {
    location,
    addEventListener: (type: string, fn: Listener) => { listeners.set(type, fn) },
    skipWaiting: () => { calls.push('skipWaiting') },
    clients: {
      claim: async () => { calls.push('claim'); fail('claim') },
      matchAll: async (o: unknown) => {
        calls.push(`matchAll ${JSON.stringify(o)}`)
        fail('matchAll')
        return [
          { url: 'https://tauri.localhost/', navigate: async (u: string) => { calls.push(`navigate ${u}`); fail('navigate') } },
          { url: 'https://tauri.localhost/#x', navigate: async (u: string) => { calls.push(`navigate ${u}`) } },
        ]
      },
    },
    registration: { unregister: async () => { calls.push('unregister'); fail('unregister'); return true } },
  }
  const caches = {
    keys: async () => { fail('keys'); return ['workbox-precache-v2', 'runtime'] },
    delete: async (n: string) => { calls.push(`delete ${n}`); return true },
  }
  new Function('self', 'caches', code)(self, caches)
  const fire = async (type: string) => {
    let pending: Promise<unknown> = Promise.resolve()
    listeners.get(type)?.({ waitUntil: (p) => { pending = p } })
    await pending
  }
  return { calls, listeners, fire }
}

describe('public/sw-native.js', () => {
  it('does nothing on the website, the dev server or an installed web app', () => {
    for (const loc of [
      { hostname: 'jesseracine.github.io', protocol: 'https:' },
      { hostname: 'localhost', protocol: 'http:' },
      { hostname: '127.0.0.1', protocol: 'http:' },
      { hostname: 'tauri.localhost.example.com', protocol: 'https:' },
    ]) {
      const w = run(loc)
      expect(w.listeners.size, loc.hostname).toBe(0)
      expect(w.calls, loc.hostname).toEqual([])
    }
  })

  it('in the native apps the new worker takes over at once (no waiting for a Reload button)', async () => {
    const w = run({ hostname: 'tauri.localhost', protocol: 'https:' })
    await w.fire('install')
    expect(w.calls).toEqual(['skipWaiting'])
  })

  it('then deletes every saved file, removes itself and reloads each open window, in that order', async () => {
    for (const loc of [{ hostname: 'tauri.localhost', protocol: 'https:' }, { hostname: 'localhost', protocol: 'tauri:' }]) {
      const w = run(loc)
      await w.fire('activate')
      expect(w.calls).toEqual([
        'claim',
        'delete workbox-precache-v2',
        'delete runtime',
        'unregister',
        'matchAll {"type":"window","includeUncontrolled":true}',
        'navigate https://tauri.localhost/',
        'navigate https://tauri.localhost/#x',
      ])
    }
  })

  it('a step that fails does not stop the others', async () => {
    for (const step of ['claim', 'keys', 'unregister', 'navigate']) {
      const w = run({ hostname: 'tauri.localhost', protocol: 'https:' }, { failStep: step })
      await expect(w.fire('activate'), step).resolves.toBeUndefined()
      expect(w.calls, step).toContain('unregister')
      expect(w.calls.some((c) => c.startsWith('navigate')), step).toBe(true)
    }
  })

  it('is loaded by the generated service worker, and is not itself part of the saved copy', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toContain("importScripts: ['sw-native.js']")
    expect(config).toContain("globIgnores: ['sw-native.js']")
  })
})
