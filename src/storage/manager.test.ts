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

describe('manager: start over', () => {
  const MARKER = '.meta/reset.json'
  const entries = () => dbm.db.entries.toArray()

  /** A device already connected to "cloud A1" that has synced before: it remembers `seen` (undefined = old version). */
  async function connectedDevice(seen: string | undefined, texts: string[]) {
    await load()
    await dbm.setMeta('storage', { backendId: 'cloud', config: { account: 'A1' }, connectedAt: 1 })
    if (seen !== undefined) await dbm.setMeta('reset:cloud', seen)
    for (const [i, t] of texts.entries()) await dbm.db.entries.put({ ...makeEntry(t, DAY + i, `e${i}`), dirty: 0 })
    await load()
  }

  it('erases this device and the storage, leaves a marker, and does not clear itself again', async () => {
    await connectedDevice('none', ['one', 'two'])
    await m.initStorage()
    const store = h.stores['cloud:A1']
    expect(store.files.has('2026/2026-11-08.md')).toBe(true)
    store.files.set('notes.md', { content: 'not ours', rev: 'x' })

    await m.startOver()
    expect(await entries()).toEqual([])
    expect([...store.files.keys()].sort()).toEqual([MARKER, 'notes.md'])
    const marker = JSON.parse(store.files.get(MARKER)!.content) as { id: string }
    expect(await dbm.getMeta('reset:cloud', null)).toBe(marker.id)

    await dbm.db.entries.put(makeEntry('a fresh start', DAY + 9, 'n1'))
    await m.syncNow()
    expect(await entries()).toHaveLength(1) // its own new entry is not cleared by its own marker
    expect(store.files.has('2026/2026-11-08.md')).toBe(true)
    expect(m.storageState().startedOverAt).toBeNull()
  })

  it('another device that synced before clears its copy instead of uploading it again, and says so', async () => {
    await connectedDevice('none', ['old phone entry'])
    const store = (h.stores['cloud:A1'] ??= (await import('./memory')).memoryStore())
    store.files.set(MARKER, { content: JSON.stringify({ id: 'm1', at: 1234 }), rev: 'r' })
    store.files.set('2026/2026-11-09.md', { content: '# Monday, 9 November 2026\n\n## 10:00 <!-- id:new1 created:1794218400000 updated:1794218400000 -->\nwritten after the start over\n', rev: 'r2' })

    await m.initStorage()
    expect((await entries()).map((e) => e.text)).toEqual(['written after the start over'])
    expect(store.files.has('2026/2026-11-08.md')).toBe(false) // the old copy was not uploaded
    expect(m.storageState().startedOverAt).toBe(1234)
    expect(await dbm.getMeta('reset:cloud', null)).toBe('m1')
    m.dismissStartedOver()
    expect(m.storageState().startedOverAt).toBeNull()
  })

  it('a device connecting to a storage that was started over keeps its entries (and uploads them)', async () => {
    await load()
    await dbm.db.entries.put(makeEntry('mine', DAY, 'e1'))
    await m.initStorage()
    h.stores['cloud:A1'] = (await import('./memory')).memoryStore({ [MARKER]: JSON.stringify({ id: 'm1', at: 1 }) })
    await startedSignIn()
    await load(`${APP}?code=A1&state=s`)
    await m.initStorage()
    expect((await entries()).map((e) => e.text)).toEqual(['mine'])
    expect(h.stores['cloud:A1'].files.has('2026/2026-11-08.md')).toBe(true)
    expect(await dbm.getMeta('reset:cloud', null)).toBe('m1')
  })

  it('a device that synced here with an older version, then updated after the start-over, clears (regression)', async () => {
    // The user's phone, 2026-11-12: it had synced with Dropbox before, got the new version only after the PC started
    // over, so it remembered no marker. It must clear instead of uploading its old copy.
    await connectedDevice(undefined, ['old phone entry'])
    await dbm.setMeta('sync:cloud', { revs: { '2026/2026-11-08.md': 'r-old' } }) // it had synced with this storage
    await load()
    h.stores['cloud:A1'] = (await import('./memory')).memoryStore({ [MARKER]: JSON.stringify({ id: 'm1', at: 77 }) })
    await m.initStorage()
    expect(await entries()).toEqual([])
    expect(h.stores['cloud:A1'].files.has('2026/2026-11-08.md')).toBe(false) // nothing uploaded again
    expect(m.storageState().startedOverAt).toBe(77)
    expect(await dbm.getMeta('reset:cloud', null)).toBe('m1')
  })

  it('a device that never synced with this storage (nothing remembered) keeps its entries and notes the marker', async () => {
    await connectedDevice(undefined, ['kept'])
    h.stores['cloud:A1'] = (await import('./memory')).memoryStore({ [MARKER]: JSON.stringify({ id: 'm1', at: 1 }) })
    await m.initStorage()
    expect((await entries()).map((e) => e.text)).toEqual(['kept'])
    expect(await dbm.getMeta('reset:cloud', null)).toBe('m1')
  })

  it('without storage it erases this device only; with storage it needs access first', async () => {
    await load()
    await dbm.db.entries.put(makeEntry('local only', DAY, 'e1'))
    await m.initStorage()
    await m.startOver()
    expect(await entries()).toEqual([])

    await dbm.db.delete()
    await connectedDevice('none', ['kept'])
    h.openRefuses = true
    await m.initStorage()
    await expect(m.startOver()).rejects.toThrow(/Allow access/)
    expect((await entries()).map((e) => e.text)).toEqual(['kept'])
  })

  it('a storage that can\'t be emptied leaves everything as it was', async () => {
    await connectedDevice('none', ['kept'])
    await m.initStorage()
    const store = h.stores['cloud:A1']
    const removeAll = store.removeAll
    ;(store as { removeAll?: unknown }).removeAll = undefined
    await expect(m.startOver()).rejects.toThrow(/can’t be emptied/)
    store.removeAll = removeAll
    expect((await entries()).map((e) => e.text)).toEqual(['kept'])
    expect(store.files.has('2026/2026-11-08.md')).toBe(true)
  })
})

describe('manager: delete permanently', () => {
  const PHOTO = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 4, h: 4 }
  const row = (id: string) => dbm.db.entries.get(id)

  async function connectedWith(entries: ReturnType<typeof makeEntry>[]) {
    await load()
    await dbm.setMeta('storage', { backendId: 'cloud', config: { account: 'A1' }, connectedAt: 1 })
    for (const e of entries) await dbm.db.entries.put(e)
    await load()
    await m.initStorage()
    return h.stores['cloud:A1']
  }

  it('syncs the deletion first, then erases the entry, lists it in purged.json and keeps the tombstone', async () => {
    const store = await connectedWith([makeEntry('secret', DAY, 'e1'), makeEntry('keep', DAY + 1, 'e2')])
    await dbm.deleteEntry('e1') // dirty: not in storage yet
    expect(await m.purgeDeleted(['e1', 'e2'])).toBe(1) // e2 is live: untouched
    await m.syncNow()
    expect(await row('e1')).toMatchObject({ text: '', deleted: 1, purged: 1, dirty: 0 })
    expect((await row('e2'))!.text).toBe('keep')
    expect(JSON.parse(store.files.get('.meta/purged.json')!.content)).toEqual(['e1'])
    expect(Object.keys(JSON.parse(store.files.get('.meta/tombstones.json')!.content))).toEqual(['e1'])
    expect(JSON.stringify([...store.files.values()])).not.toContain('secret')
  })

  it('removes the photo files only these entries used, but keeps one another entry still uses', async () => {
    const store = await connectedWith([
      { ...makeEntry('mine', DAY, 'e1', [PHOTO]) },
      { ...makeEntry('shared', DAY + 1, 'e2', [PHOTO, { ...PHOTO, hash: 'bbbbbbbbbbbbbbbb' }]) },
    ])
    store.blobs.set('2026/images/aaaaaaaaaaaaaaaa.jpg', new Blob(['a']))
    store.blobs.set('2026/images/bbbbbbbbbbbbbbbb.jpg', new Blob(['b']))
    await dbm.deleteEntry('e1')
    await dbm.deleteEntry('e2') // deleted, but stays restorable
    await m.purgeDeleted(['e1'])
    expect([...store.blobs.keys()]).toEqual(['2026/images/aaaaaaaaaaaaaaaa.jpg', '2026/images/bbbbbbbbbbbbbbbb.jpg']) // e2 still uses both
    expect((await row('e2'))!.images).toHaveLength(2)

    await m.purgeDeleted(['e2'])
    expect(store.blobs.size).toBe(0)
  })

  it('erases nothing when the storage can’t be reached or a photo can’t be removed', async () => {
    const store = await connectedWith([makeEntry('secret', DAY, 'e1', [PHOTO])])
    store.blobs.set('2026/images/aaaaaaaaaaaaaaaa.jpg', new Blob(['a']))
    await dbm.deleteEntry('e1')
    await m.syncNow()
    const removeBlob = store.removeBlob
    store.removeBlob = async () => { throw new Error('locked') }
    await expect(m.purgeDeleted(['e1'])).rejects.toThrow(/nothing was erased: .*locked/)
    expect((await row('e1'))!.text).toBe('secret')
    store.removeBlob = removeBlob

    h.openRefuses = true
    await load()
    await m.initStorage()
    await expect(m.purgeDeleted(['e1'])).rejects.toThrow(/Allow access/)
    expect((await row('e1'))!.text).toBe('secret')
  })

  it('without a storage it erases right away, and lists the id once a storage is connected', async () => {
    await load()
    await dbm.db.entries.put(makeEntry('secret', DAY, 'e1'))
    await m.initStorage()
    await dbm.deleteEntry('e1')
    expect(await m.purgeDeleted(['e1'])).toBe(1)
    expect(await row('e1')).toMatchObject({ text: '', purged: 1 })
    await m.connect('local')
    expect(JSON.parse(h.stores['local:L'].files.get('.meta/purged.json')!.content)).toEqual(['e1'])
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
