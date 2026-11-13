import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEntry } from '../lib/entry'
import type { memoryStore } from './memory'
import type { StorageBackend } from './types'

/*
 * manager.ts is a singleton that starts timers and reads the page (location, history, document), so each test loads
 * a fresh copy with a fake page and two fake storage modules: "cloud" signs in on another site (has resumeSetup),
 * "local" is folder-like (asks for permission again). Both keep their files in memory.
 */

type MemStore = ReturnType<typeof memoryStore>

const h = vi.hoisted(() => ({
  stores: {} as Record<string, MemStore>,
  calls: [] as string[],
  resumeError: null as Error | null,
  openRefuses: false,
}))

vi.mock('./backends', async () => {
  const { memoryStore } = await import('./memory')
  const storeOf = (key: string) => (h.stores[key] ??= memoryStore())
  const cloud: StorageBackend<{ account: string }> = {
    id: 'cloud',
    name: 'Cloud',
    description: '',
    unsupportedReason: () => null,
    async setup() {
      h.calls.push('cloud.setup')
      return new Promise<never>(() => {}) // leaves the page, like Dropbox
    },
    async resumeSetup(href) {
      h.calls.push(`cloud.resume ${new URL(href).search}`)
      if (h.resumeError) throw h.resumeError
      const account = new URL(href).searchParams.get('code') ?? ''
      return { config: { account }, store: storeOf(`cloud:${account}`), label: `Cloud ${account}` }
    },
    async open(config, interactive) {
      h.calls.push(`cloud.open ${config.account} ${interactive}`)
      if (h.openRefuses) return { ok: false, reason: 'needs-permission' }
      return { ok: true, store: storeOf(`cloud:${config.account}`), label: `Cloud ${config.account}` }
    },
  }
  const local: StorageBackend<{ name: string }> = {
    id: 'local',
    name: 'Local',
    description: '',
    unsupportedReason: () => null,
    async setup() {
      h.calls.push('local.setup')
      return { config: { name: 'L' }, store: storeOf('local:L'), label: 'Local L' }
    },
    async open(config, interactive) {
      h.calls.push(`local.open ${config.name} ${interactive}`)
      if (h.openRefuses && !interactive) return { ok: false, reason: 'needs-permission' }
      return { ok: true, store: storeOf(`local:${config.name}`), label: `Local ${config.name}` }
    },
  }
  const BACKENDS = [cloud, local] as StorageBackend<never>[]
  return { BACKENDS, PLANNED_BACKENDS: [], backendById: (id: string) => BACKENDS.find((b) => b.id === id) }
})

const APP = 'https://app.example.test/diary/'
const DAY = new Date(2026, 10, 8, 9).getTime()

let page: { doc: EventTarget & { visibilityState: string }; replaced: string[] }
let m: typeof import('./manager')
let dbm: typeof import('../lib/db')

/** A fresh app start at `href`, with a fake page around it. */
async function load(href = APP) {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const replaced: string[] = []
  vi.stubGlobal('document', doc)
  vi.stubGlobal('location', new URL(href))
  vi.stubGlobal('history', { state: null, replaceState: (_s: unknown, _t: string, u: string) => { replaced.push(String(u)) } })
  page = { doc, replaced }
  dbm?.db.close() // the previous "app start" lets go of the database, like a closed tab
  vi.resetModules()
  dbm = await import('../lib/db')
  m = await import('./manager')
}

/** Wait until `check` holds (for work started by an event handler). */
async function until(check: () => boolean | Promise<boolean>, what: string) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`timed out waiting for: ${what}`)
}

const saved = () => dbm.getMeta<{ backendId: string; config: unknown; connectedAt?: number } | null>('storage', null)
const startedSignIn = (backendId = 'cloud') =>
  dbm.setMeta('oauth:pending', { backendId, state: 's', verifier: 'v', redirectUri: APP, startedAt: Date.now() })

beforeEach(() => {
  h.stores = {}
  h.calls = []
  h.resumeError = null
  h.openRefuses = false
  vi.spyOn(globalThis, 'setInterval').mockImplementation((() => 0) as unknown as typeof setInterval) // no 5-minute timer
})

afterEach(async () => {
  await dbm?.db.delete() // the next test opens a new, empty database under the same name
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('manager: finishing a sign-in when the page loads again', () => {
  it('adopts the new storage, cleans the URL, saves it with connectedAt and syncs into it', async () => {
    await load()
    await dbm.db.entries.put(makeEntry('written before connecting', DAY, 'e1'))
    await dbm.db.blobs.put({ hash: 'aaaaaaaaaaaaaaaa', blob: new Blob([new Uint8Array(4)]), mime: 'image/jpeg', size: 4, onRemote: 1, addedAt: 1 })
    await dbm.setMeta('sync:cloud', { revs: { 'old/path.md': 'r9' } }) // from an earlier Dropbox: must not carry over
    await startedSignIn()
    await load(`${APP}?code=A1&state=s&keep=1`)
    await m.initStorage()

    expect(h.calls).toEqual(['cloud.resume ?code=A1&state=s&keep=1']) // no second open of the same storage
    expect(page.replaced).toEqual([`${APP}?keep=1`])
    const s = m.storageState()
    expect(s).toMatchObject({ backendId: 'cloud', label: 'Cloud A1', status: 'ok', signInError: null, restored: true })
    const stored = await saved()
    expect(stored).toMatchObject({ backendId: 'cloud', config: { account: 'A1' } })
    expect(stored?.connectedAt).toBeGreaterThan(0)
    expect(h.stores['cloud:A1'].files.has('2026/2026-11-08.md')).toBe(true) // the first sync ran
    expect((await dbm.db.blobs.get('aaaaaaaaaaaaaaaa'))?.onRemote).toBe(0) // the new storage doesn't have the photo yet
  })

  it('a failed return shows a message and opens the storage that was already chosen', async () => {
    await load()
    await dbm.setMeta('storage', { backendId: 'local', config: { name: 'L' } })
    await startedSignIn()
    h.resumeError = new Error('Sign-in was cancelled.')
    await load(`${APP}?error=access_denied&state=s`)
    await m.initStorage()

    expect(page.replaced).toEqual([APP])
    expect(m.storageState()).toMatchObject({ backendId: 'local', status: 'ok', signInError: 'Sign-in was cancelled.' })
    expect((await saved())?.backendId).toBe('local')
    m.dismissSignInError()
    expect(m.storageState().signInError).toBeNull()
  })

  it('a return nobody started is reported and changes nothing', async () => {
    await load(`${APP}?code=X&state=s`)
    await m.initStorage()
    expect(h.calls).toEqual([])
    expect(m.storageState()).toMatchObject({ backendId: null, status: 'off', restored: true })
    expect(m.storageState().signInError).toMatch(/not started here/)
    expect(page.replaced).toEqual([APP])
  })

  it('an ordinary start leaves the URL alone and opens the saved storage', async () => {
    await load()
    await dbm.setMeta('storage', { backendId: 'cloud', config: { account: 'A1' }, connectedAt: 5 })
    await load(`${APP}?q=x`)
    await m.initStorage()
    expect(page.replaced).toEqual([])
    expect(h.calls).toEqual(['cloud.open A1 false'])
    expect(m.storageState()).toMatchObject({ backendId: 'cloud', status: 'ok', signInError: null })
  })
})

describe('manager: a storage chosen in another tab', () => {
  async function openWith(storage: object) {
    await load()
    await dbm.setMeta('storage', storage)
    await load()
    await m.initStorage()
    h.calls = []
  }
  const show = () => page.doc.dispatchEvent(new Event('visibilitychange'))

  it('is opened here when this window becomes visible', async () => {
    await openWith({ backendId: 'local', config: { name: 'L' }, connectedAt: 1 })
    await dbm.db.entries.put(makeEntry('here', DAY, 'e1'))
    // Another tab (e.g. the browser tab a Dropbox sign-in returned to on Android) chose the cloud storage.
    await dbm.setMeta('storage', { backendId: 'cloud', config: { account: 'B2' }, connectedAt: 2 })
    show()
    await until(() => m.storageState().backendId === 'cloud' && m.storageState().status === 'ok', 'cloud opened')
    expect(h.calls).toContain('cloud.open B2 false')
    expect(m.storageState().label).toBe('Cloud B2')
    await until(() => h.stores['cloud:B2'].files.has('2026/2026-11-08.md'), 'synced into the new storage')
  })

  it('is not reopened when nothing changed, nor for a storage saved by an older version (no connectedAt)', async () => {
    await openWith({ backendId: 'local', config: { name: 'L' }, connectedAt: 1 })
    show()
    await new Promise((r) => setTimeout(r, 30))
    expect(h.calls.filter((c) => c.includes('.open'))).toEqual([])

    await openWith({ backendId: 'local', config: { name: 'L' } })
    show()
    await new Promise((r) => setTimeout(r, 30))
    expect(h.calls.filter((c) => c.includes('.open'))).toEqual([])
  })

  it('this window choosing a storage itself does not count as another tab', async () => {
    await openWith({ backendId: 'cloud', config: { account: 'A1' }, connectedAt: 1 })
    await m.connect('local')
    h.calls = []
    show()
    await new Promise((r) => setTimeout(r, 30))
    expect(h.calls.filter((c) => c.includes('.open'))).toEqual([])
    expect(m.storageState().backendId).toBe('local')
  })
})

describe('manager: connect and reconnect', () => {
  it('connect saves the storage with connectedAt, resets its sync state and syncs', async () => {
    await load()
    await dbm.db.entries.put(makeEntry('first', DAY, 'e1'))
    await dbm.setMeta('sync:local', { revs: { 'x.md': 'r1' } })
    await m.initStorage()
    await m.connect('local')
    expect(m.storageState()).toMatchObject({ backendId: 'local', status: 'ok' })
    expect((await saved())?.connectedAt).toBeGreaterThan(0)
    expect(Object.keys((await dbm.getMeta<{ revs: Record<string, string> }>('sync:local', { revs: {} })).revs)).toEqual(['2026/2026-11-08.md'])
    expect(h.stores['local:L'].files.has('2026/2026-11-08.md')).toBe(true)
  })

  it('a sign-in module that lost access signs in again; a folder asks for permission again', async () => {
    await load()
    await dbm.setMeta('storage', { backendId: 'cloud', config: { account: 'A1' }, connectedAt: 1 })
    h.openRefuses = true
    await load()
    await m.initStorage()
    expect(m.storageState().status).toBe('needs-permission')
    h.calls = []
    void m.reconnect() // leaves the page (never resolves)
    await until(() => h.calls.length > 0, 'reconnect')
    expect(h.calls).toEqual(['cloud.setup'])

    await dbm.db.delete()
    await load()
    await dbm.setMeta('storage', { backendId: 'local', config: { name: 'L' }, connectedAt: 1 })
    await load()
    await m.initStorage()
    expect(m.storageState().status).toBe('needs-permission')
    h.calls = []
    await m.reconnect()
    expect(h.calls).toEqual(['local.open L true'])
    expect(m.storageState().status).toBe('ok')
  })

  it('disconnect forgets the storage, so another tab choosing the same one later is picked up', async () => {
    await load()
    await dbm.setMeta('storage', { backendId: 'local', config: { name: 'L' }, connectedAt: 1 })
    await load()
    await m.initStorage()
    await m.disconnect()
    expect(m.storageState()).toMatchObject({ backendId: null, status: 'off' })
    expect(await saved()).toBeNull()
    await dbm.setMeta('storage', { backendId: 'local', config: { name: 'L' }, connectedAt: 1 })
    page.doc.dispatchEvent(new Event('visibilitychange'))
    await until(() => m.storageState().backendId === 'local', 'reopened')
  })
})
