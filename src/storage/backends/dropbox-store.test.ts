import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from '../../lib/entry'
import { hashBytes } from '../../lib/images'
import type { ImageLocal } from '../attachments'
import { memoryLocal } from '../memory'
import { fetchOriginal } from '../originals'
import { emptySyncState } from '../sync'
import { syncAll } from '../syncAll'
import { BlobCollisionError, type FileStore, type SyncState } from '../types'
import { DropboxError, dropboxStore, headerJson, refreshingToken } from './dropbox-store'
import { fakeDropbox } from './fake-dropbox'
import { signedOutError } from './oauth'

function setup(opts: { pageSize?: number; retries?: number } = {}) {
  const fake = fakeDropbox({ pageSize: opts.pageSize })
  let refreshes = 0
  const waits: number[] = []
  const token = refreshingToken(async () => {
    refreshes++
    return { accessToken: fake.token, expiresAt: Number.MAX_SAFE_INTEGER, data: {} }
  })
  const store = dropboxStore({ token, fetch: fake.fetch, sleep: async (ms) => { waits.push(ms) }, retries: opts.retries })
  return { fake, store, waits, get refreshes() { return refreshes } }
}

const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill)
const blob = (n: number, fill = 7) => new Blob([bytes(n, fill)])
const IMG = '2026/images/0123456789abcdef.jpg'

describe('dropboxStore: text files', () => {
  it('writes, lists, reads and removes day files', async () => {
    const { fake, store } = setup()
    const rev = await store.write('2026/2026-11-08.md', '# Sunday\n\nhello é\n')
    expect(fake.text('/2026/2026-11-08.md')).toBe('# Sunday\n\nhello é\n')
    expect(await store.list()).toEqual([{ path: '2026/2026-11-08.md', rev }])
    expect(await store.read('2026/2026-11-08.md')).toBe('# Sunday\n\nhello é\n')
    await store.remove('2026/2026-11-08.md')
    expect(await store.list()).toEqual([])
    expect(await store.read('2026/2026-11-08.md')).toBeNull()
  })

  it('an empty or not yet created app folder lists nothing; missing files read as null and remove quietly', async () => {
    const { store } = setup()
    expect(await store.list()).toEqual([])
    expect(await store.read('2026/2026-01-01.md')).toBeNull()
    await expect(store.remove('2026/2026-01-01.md')).resolves.toBeUndefined() // delete_v2's path_lookup/not_found
  })

  it('rev is the content hash: the same text gives the same rev, other text a new one', async () => {
    const { store } = setup()
    const a = await store.write('2026/2026-11-08.md', 'one')
    expect(await store.write('2026/2026-11-08.md', 'two')).not.toBe(a)
    expect(await store.write('2026/2026-11-08.md', 'one')).toBe(a)
    expect((await store.list())[0].rev).toBe(a)
  })

  it('lists only diary files, across years and pages, without walking image folders', async () => {
    const { fake, store } = setup({ pageSize: 2 })
    for (const d of ['01', '02', '03', '04', '05']) await fake.put(`/2026/2026-11-${d}.md`, d)
    await fake.put('/2025/2025-12-31.md', 'old')
    await fake.put('/.meta/tombstones.json', '{}')
    await fake.put('/2026/notes.txt', 'not ours')
    await fake.put('/README.md', 'not ours')
    await fake.put(`/${IMG}`, bytes(3))
    await fake.put('/.thumbs/0123456789abcdef.jpg', bytes(2))
    const paths = (await store.list()).map((f) => f.path).sort()
    expect(paths).toEqual([
      '.meta/tombstones.json', '2025/2025-12-31.md',
      '2026/2026-11-01.md', '2026/2026-11-02.md', '2026/2026-11-03.md', '2026/2026-11-04.md', '2026/2026-11-05.md',
    ])
    const listed = fake.calls.filter((c) => c.endpoint === 'files/list_folder').map((c) => c.arg.path)
    expect(listed.sort()).toEqual(['', '/.meta', '/2025', '/2026'])
    expect(fake.calls.some((c) => c.endpoint === 'files/list_folder/continue')).toBe(true)
  })

  it('treats paths case-insensitively, like Dropbox', async () => {
    const { fake, store } = setup()
    await fake.put('/2026/2026-11-08.MD', 'upper') // not a diary file name, so not listed...
    expect(await store.list()).toEqual([])
    await store.write('2026/2026-11-08.md', 'lower') // ...but it is the same file to Dropbox
    expect(fake.files.size).toBe(1)
    expect(fake.text('/2026/2026-11-08.md')).toBe('lower')
  })

  it('sends non-ASCII in the Dropbox-API-Arg header as \\u escapes', () => {
    expect(headerJson({ path: '/é\u007f' })).toBe('{"path":"/\\u00e9\\u007f"}')
  })
})

describe('dropboxStore: photos', () => {
  it('writes, checks, reads and removes a blob', async () => {
    const { store } = setup()
    expect(await store.hasBlob(IMG)).toBeNull()
    expect(await store.readBlob(IMG)).toBeNull()
    await store.writeBlob(IMG, blob(10))
    expect(await store.hasBlob(IMG)).toEqual({ size: 10 })
    const back = await store.readBlob(IMG)
    expect(new Uint8Array(await back!.arrayBuffer())).toEqual(bytes(10))
    await store.removeBlob(IMG)
    expect(await store.hasBlob(IMG)).toBeNull()
    await expect(store.removeBlob(IMG)).resolves.toBeUndefined() // already gone: fine
  })

  it('never overwrites a photo: same size is a no-op, another size is a BlobCollisionError', async () => {
    const { fake, store } = setup()
    await store.writeBlob(IMG, blob(10, 1))
    const before = fake.files.get(`/${IMG}`)!
    await store.writeBlob(IMG, blob(10, 2))
    expect(fake.files.get(`/${IMG}`)).toBe(before)
    await expect(store.writeBlob(IMG, blob(11))).rejects.toThrow(BlobCollisionError)
    expect(fake.files.get(`/${IMG}`)).toBe(before)
    expect(fake.calls.filter((c) => c.endpoint === 'files/upload').every((c) => c.arg.mode === 'add')).toBe(true)
  })

  it('a photo written by another device in the meantime is handled the same way (upload conflict)', async () => {
    const { fake, store } = setup()
    let sneak = 10
    fake.beforeHandle(async (c) => {
      if (c.endpoint === 'files/upload') await fake.put(`/${IMG}`, bytes(sneak))
    })
    await expect(store.writeBlob(IMG, blob(10))).resolves.toBeUndefined()
    fake.files.clear()
    sneak = 12
    await expect(store.writeBlob(IMG, blob(10))).rejects.toThrow(BlobCollisionError)
    expect(fake.files.get(`/${IMG}`)!.bytes.length).toBe(12)
  })

  it('removeAll deletes the year folders, .meta and .thumbs, and nothing else', async () => {
    const { fake, store } = setup()
    await fake.put('/2026/2026-11-08.md', 'day')
    await fake.put(`/${IMG}`, bytes(3))
    await fake.put('/2025/2025-01-01.md', 'old')
    await fake.put('/.meta/tombstones.json', '{}')
    await fake.put('/.thumbs/0123456789abcdef.webp', bytes(2))
    await fake.put('/README.md', 'not ours')
    await fake.put('/notes/2026-11-08.md', 'not ours either')
    await store.removeAll!()
    expect([...fake.files.values()].map((f) => f.display).sort()).toEqual(['/README.md', '/notes/2026-11-08.md'])
    expect(fake.calls.filter((c) => c.endpoint === 'files/delete_v2').map((c) => c.arg.path).sort())
      .toEqual(['/.meta', '/.thumbs', '/2025', '/2026']) // one call per folder
    await expect(store.removeAll!()).resolves.toBeUndefined() // nothing left to delete: fine
  })

  it('removeBlob refuses anything that is not an image path', async () => {
    const { fake, store } = setup()
    await fake.put('/2026/2026-11-08.md', 'keep me')
    await expect(store.removeBlob('2026/2026-11-08.md')).rejects.toThrow(/Not an image path/)
    await expect(store.removeBlob('.meta/tombstones.json')).rejects.toThrow(/Not an image path/)
    expect(fake.text('/2026/2026-11-08.md')).toBe('keep me')
  })
})

describe('dropboxStore: tokens, limits and errors', () => {
  it('gets a new access token once when the old one has expired, then carries on', async () => {
    const s = setup()
    await s.store.write('2026/2026-11-08.md', 'a')
    expect(s.refreshes).toBe(1)
    s.fake.expireToken()
    expect(await s.store.read('2026/2026-11-08.md')).toBe('a')
    expect(s.refreshes).toBe(2)
    await s.store.list()
    expect(s.refreshes).toBe(2) // the new token is kept
  })

  it('a token that is refused even after refreshing means signing in again', async () => {
    const fake = fakeDropbox()
    const token = refreshingToken(async () => ({ accessToken: 'stale', expiresAt: Number.MAX_SAFE_INTEGER, data: {} }))
    const store = dropboxStore({ token, fetch: fake.fetch })
    const err = await store.list().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('NotAllowedError')
  })

  it('a revoked refresh token (signedOutError) reaches the caller unchanged', async () => {
    const fake = fakeDropbox()
    const token = refreshingToken(async () => { throw signedOutError('Dropbox') })
    const store = dropboxStore({ token, fetch: fake.fetch })
    await expect(store.read('2026/2026-11-08.md')).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(fake.calls).toEqual([]) // nothing was sent without a token
  })

  it('refreshes an access token that is about to expire before using it, sharing one refresh', async () => {
    let clock = 0
    let n = 0
    const token = refreshingToken(async () => ({ accessToken: `t${++n}`, expiresAt: clock + 100, data: {} }), () => clock)
    expect(await Promise.all([token(false), token(false)])).toEqual(['t1', 't1'])
    clock = 99
    expect(await token(false)).toBe('t1')
    clock = 100
    expect(await token(false)).toBe('t2')
    expect(await token(true)).toBe('t3')
  })

  it('waits as long as Retry-After says on 429, then succeeds', async () => {
    const { fake, store, waits } = setup()
    fake.rateLimit(2, 3)
    await store.write('2026/2026-11-08.md', 'x')
    expect(waits).toEqual([3000, 3000])
    expect(fake.text('/2026/2026-11-08.md')).toBe('x')
  })

  it('gives up after the allowed retries with a readable error', async () => {
    const { fake, store, waits } = setup({ retries: 2 })
    fake.rateLimit(5, 1)
    const err = await store.write('2026/2026-11-08.md', 'x').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DropboxError)
    expect((err as DropboxError).status).toBe(429)
    expect(waits).toHaveLength(2)
  })

  it('other endpoint errors throw without leaking the token', async () => {
    const { fake, store } = setup()
    fake.beforeHandle(() => { throw new Error('unreachable') })
    await expect(store.list()).rejects.toThrow('unreachable')
    fake.beforeHandle(null)
    const full = fakeDropbox()
    const fullStore = dropboxStore({
      token: refreshingToken(async () => ({ accessToken: full.token, expiresAt: Number.MAX_SAFE_INTEGER, data: {} })),
      fetch: (async () => new Response(JSON.stringify({ error_summary: 'path/insufficient_space/..' }), { status: 409 })) as typeof fetch,
    })
    const err = (await fullStore.write('2026/2026-11-08.md', 'x').catch((e: unknown) => e)) as Error
    expect(err.message).toBe('Your Dropbox is full.')
    expect(err.message).not.toContain(full.token)
  })
})

describe('two devices syncing through the fake Dropbox (sync engine + photos)', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()

  /** A device with its own database, photos and sync state, but its own token for the same Dropbox. */
  function device(fake: ReturnType<typeof fakeDropbox>, entries: Entry[] = [], originals: Record<string, Blob> = {}, thumbs: Record<string, Blob> = {}) {
    const local = memoryLocal(entries)
    const onRemote = new Set<string>()
    const images: ImageLocal = {
      snapshot: () => local.snapshot(),
      original: async (h) => originals[h] ?? null,
      thumb: async (h) => thumbs[h] ?? null,
      markOnRemote: async (h) => { onRemote.add(h) },
      unsaved: async () => Object.keys(originals).filter((h) => !onRemote.has(h)),
      saveThumb: async (h, b) => { thumbs[h] = b },
      thumbnail: async () => null,
    }
    const store: FileStore = dropboxStore({
      token: refreshingToken(async () => ({ accessToken: fake.token, expiresAt: Number.MAX_SAFE_INTEGER, data: {} })),
      fetch: fake.fetch,
    })
    let state: SyncState = emptySyncState()
    let confirmed = new Set<string>()
    return {
      local, thumbs, store,
      async sync() {
        const r = await syncAll(local, images, store, state, confirmed)
        state = r.state
        confirmed = r.confirmed
        return r
      },
      live: () => [...local.entries.values()].filter((e) => !e.deleted).map((e) => e.text).sort(),
      add(text: string, ts: number, id: string) { local.entries.set(id, makeEntry(text, ts, id)) },
      edit(id: string, text: string, ts: number) {
        const e = local.entries.get(id)!
        local.entries.set(id, { ...makeEntry(text, e.createdAt, id, e.images), updatedAt: ts })
      },
    }
  }

  it('an entry and its photo travel Windows → Android and edits come back, including offline ones', async () => {
    const fake = fakeDropbox()
    const A: ImageRef = { hash: await hashBytes(bytes(40, 3)), ext: 'jpg', w: 4, h: 3 } // photos are named by their content
    const original = blob(40, 3)
    const thumb = blob(6, 4)
    const windows = device(fake, [makeEntry('photo from windows', at(8, 9), 'w1', [A])], { [A.hash]: original }, { [A.hash]: thumb })
    const r1 = await windows.sync()
    expect(r1.images?.errors).toEqual([])
    expect(fake.text('/2026/2026-11-08.md')).toContain('photo from windows')
    expect(fake.files.has(`/2026/images/${A.hash}.jpg`)).toBe(true)

    const android = device(fake)
    const r2 = await android.sync()
    expect(android.live()).toEqual(['photo from windows'])
    expect(r2.pulled?.fetched).toBe(1)
    expect(new Uint8Array(await android.thumbs[A.hash].arrayBuffer())).toEqual(bytes(6, 4))
    const fetched = await fetchOriginal(android.store as Parameters<typeof fetchOriginal>[0], A, ['2026'])
    expect(new Uint8Array(await fetched!.arrayBuffer())).toEqual(bytes(40, 3))

    // Both offline for a while, then both sync.
    windows.add('windows offline', at(8, 10), 'w2')
    android.add('android offline', at(8, 10, 5), 'p1')
    android.edit('w1', 'photo from windows, edited on android', at(8, 11))
    await windows.sync()
    await android.sync()
    await windows.sync()
    expect(windows.live()).toEqual(['android offline', 'photo from windows, edited on android', 'windows offline'])
    expect(android.live()).toEqual(windows.live())
    expect(windows.local.entries.get('w1')?.images).toEqual([A])

    // Nothing changed: a further sync writes nothing.
    const quiet = await windows.sync()
    expect(quiet.report).toEqual({ read: 0, written: 0, removed: 0, updatedLocally: 0 })
  })
})
