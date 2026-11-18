import { describe, expect, it } from 'vitest'
import { type Entry, type ImageRef, makeEntry } from '../../lib/entry'
import { hashBytes } from '../../lib/images'
import type { ImageLocal } from '../attachments'
import { memoryLocal } from '../memory'
import { fetchOriginal } from '../originals'
import { emptySyncState } from '../sync'
import { syncAll } from '../syncAll'
import { BlobCollisionError, type FileStore, type SyncState } from '../types'
import { fakePCloud } from './fake-pcloud'
import { DEV_FOLDER } from './pcloud'
import { PCloudError, pcloudStore } from './pcloud-store'

type Fake = ReturnType<typeof fakePCloud>

function storeOn(fake: Fake, opts: { folder?: string; token?: string; retries?: number; waits?: number[] } = {}) {
  return pcloudStore({
    session: { token: opts.token ?? fake.token, hostname: fake.hostname, uid: '42', folder: opts.folder ?? '' },
    fetch: fake.fetch,
    sleep: async (ms) => { opts.waits?.push(ms) },
    retries: opts.retries,
  })
}

const bytes = (n: number, fill = 7) => new Uint8Array(n).fill(fill)
const blob = (n: number, fill = 7) => new Blob([bytes(n, fill)])
const IMG = '2026/images/0123456789abcdef.jpg'

describe('pcloudStore: text files', () => {
  it('writes (creating the folders), lists, reads and removes day files', async () => {
    const fake = fakePCloud()
    const store = storeOn(fake)
    expect(await store.list()).toEqual([])
    const rev = await store.write('2026/2026-11-08.md', '# Sunday\n\nhello é\n')
    expect(fake.text('/2026/2026-11-08.md')).toBe('# Sunday\n\nhello é\n')
    expect(await store.list()).toEqual([{ path: '2026/2026-11-08.md', rev }])
    expect(await store.read('2026/2026-11-08.md')).toBe('# Sunday\n\nhello é\n')
    await store.remove('2026/2026-11-08.md')
    expect(await store.list()).toEqual([])
    expect(await store.read('2026/2026-11-08.md')).toBeNull()
    await expect(store.remove('2026/2026-11-08.md')).resolves.toBeUndefined()
  })

  it('rev follows the content: the same text gives the same rev, other text a new one', async () => {
    const store = storeOn(fakePCloud())
    const a = await store.write('2026/2026-11-08.md', 'one')
    expect(await store.write('2026/2026-11-08.md', 'two')).not.toBe(a)
    expect(await store.write('2026/2026-11-08.md', 'one')).toBe(a)
    expect((await store.list())[0].rev).toBe(a)
  })

  it('lists only diary files, without walking image folders', async () => {
    const fake = fakePCloud()
    await fake.put('/2026/2026-11-01.md', 'a')
    await fake.put('/2025/2025-12-31.md', 'old')
    await fake.put('/.meta/tombstones.json', '{}')
    await fake.put('/2026/notes.txt', 'not ours')
    await fake.put('/README.md', 'not ours')
    await fake.put(`/${IMG}`, bytes(3))
    await fake.put('/.thumbs/0123456789abcdef.jpg', bytes(2))
    expect((await storeOn(fake).list()).map((f) => f.path).sort()).toEqual(['.meta/tombstones.json', '2025/2025-12-31.md', '2026/2026-11-01.md'])
    expect(fake.calls.filter((c) => c.method === 'listfolder').map((c) => c.params.path).sort()).toEqual(['/', '/.meta', '/2025', '/2026'])
  })
})

describe('pcloudStore: the development folder', () => {
  it('works only inside it: the real journal is never listed, read, written or erased', async () => {
    const fake = fakePCloud()
    await fake.put('/2026/2026-11-08.md', 'the real journal')
    const dev = storeOn(fake, { folder: DEV_FOLDER })
    expect(await dev.list()).toEqual([])
    expect(await dev.read('2026/2026-11-08.md')).toBeNull()
    await dev.write('2026/2026-11-08.md', 'a test')
    await dev.removeAll!()
    expect(fake.text('/2026/2026-11-08.md')).toBe('the real journal')
    expect(fake.calls.every((c) => !c.params.path || c.params.path.startsWith(`/${DEV_FOLDER}`))).toBe(true)
  })

  it("the real journal's Start over leaves the development folder alone", async () => {
    const fake = fakePCloud()
    await fake.put('/2026/2026-11-08.md', 'real')
    await fake.put(`/${DEV_FOLDER}/2026/2026-11-08.md`, 'test')
    await fake.put('/README.md', 'not ours')
    await storeOn(fake).removeAll!()
    expect([...fake.files.keys()].sort()).toEqual(['/README.md', `/${DEV_FOLDER}/2026/2026-11-08.md`])
  })
})

describe('pcloudStore: photos', () => {
  it('writes, checks, reads and removes a photo', async () => {
    const store = storeOn(fakePCloud())
    expect(await store.hasBlob(IMG)).toBeNull()
    expect(await store.readBlob(IMG)).toBeNull()
    await store.writeBlob(IMG, blob(10))
    expect(await store.hasBlob(IMG)).toEqual({ size: 10 })
    expect(new Uint8Array(await (await store.readBlob(IMG))!.arrayBuffer())).toEqual(bytes(10))
    await store.removeBlob(IMG)
    expect(await store.hasBlob(IMG)).toBeNull()
    await expect(store.removeBlob(IMG)).resolves.toBeUndefined()
    await expect(store.removeBlob('2026/2026-11-08.md')).rejects.toThrow(/Not an image path/)
  })

  it('never overwrites a photo: same size is a no-op, another size is a BlobCollisionError', async () => {
    const fake = fakePCloud()
    const store = storeOn(fake)
    await store.writeBlob(IMG, blob(10, 1))
    const before = fake.files.get(`/${IMG}`)!
    await store.writeBlob(IMG, blob(10, 2))
    await expect(store.writeBlob(IMG, blob(11))).rejects.toThrow(BlobCollisionError)
    expect(fake.files.get(`/${IMG}`)).toBe(before)
    expect(fake.calls.filter((c) => c.method === 'uploadfile').every((c) => c.params.renameifexists === '1')).toBe(true)
  })

  it('a photo another device wrote in the meantime: the renamed extra copy is removed, the original kept', async () => {
    const fake = fakePCloud()
    const store = storeOn(fake)
    let sneak = 12
    fake.beforeHandle((c) => { if (c.method === 'uploadfile') fake.put(`/${IMG}`, bytes(sneak)) })
    await expect(store.writeBlob(IMG, blob(10))).rejects.toThrow(BlobCollisionError)
    expect([...fake.files.keys()]).toEqual([`/${IMG}`])
    expect(fake.files.get(`/${IMG}`)!.bytes.length).toBe(12)
    fake.files.clear()
    sneak = 10
    await expect(store.writeBlob(IMG, blob(10))).resolves.toBeUndefined()
    expect([...fake.files.keys()]).toEqual([`/${IMG}`])
  })
})

describe('pcloudStore: reading without download links (pCloud refuses them to web pages)', () => {
  it('reads through getzip, never getfilelink, and refuses a download whose size does not match', async () => {
    const fake = fakePCloud()
    const store = storeOn(fake)
    await store.write('2026/2026-11-08.md', 'hello')
    expect(await store.read('2026/2026-11-08.md')).toBe('hello')
    expect(fake.calls.map((c) => c.method)).not.toContain('getfilelink')
    // Another device rewrites the file between the size check and the download: this read fails (the next sync tries
    // again) instead of returning text that does not match what was listed.
    fake.beforeHandle((c) => { if (c.method === 'getzip') fake.put('/2026/2026-11-08.md', 'hello, longer now') })
    await expect(store.read('2026/2026-11-08.md')).rejects.toThrow(/incomplete|no file|could not read/)
  })
})

describe('pcloudStore: errors', () => {
  it('a refused token means signing in again, without leaking the token', async () => {
    const fake = fakePCloud()
    const err = (await storeOn(fake, { token: 'revoked-token' }).list().catch((e: unknown) => e)) as DOMException
    expect(err).toBeInstanceOf(DOMException)
    expect(err.name).toBe('NotAllowedError')
    expect(err.message).not.toContain('revoked-token')
  })

  it('waits when pCloud says to slow down, then succeeds; gives up after the allowed retries', async () => {
    const fake = fakePCloud()
    const waits: number[] = []
    fake.slowDownFor(2)
    await storeOn(fake, { waits }).write('2026/2026-11-08.md', 'x')
    expect(waits).toEqual([1000, 2000])
    expect(fake.text('/2026/2026-11-08.md')).toBe('x')

    fake.slowDownFor(9)
    const err = await storeOn(fake, { retries: 1 }).write('2026/2026-11-08.md', 'y').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(PCloudError)
    expect(fake.text('/2026/2026-11-08.md')).toBe('x')
  })

  it('the "has anything changed?" check sees another device, and says "changed" when unsure', async () => {
    const fake = fakePCloud()
    const store = storeOn(fake)
    await store.write('2026/2026-11-08.md', 'one')
    const mark = (await store.changes!.bookmark())!
    expect(await store.changes!.changedSince(mark)).toBe(false)
    fake.put('/2026/2026-11-09.md', 'from the other device')
    expect(await store.changes!.changedSince(mark)).toBe(true)
    expect(await store.changes!.changedSince('not a diffid')).toBe(true)
    const signedOut = storeOn(fake, { token: 'revoked' })
    expect(await signedOut.changes!.bookmark()).toBeNull()
    expect(await signedOut.changes!.changedSince(mark)).toBe(true)
  })
})

describe('two devices syncing through the fake pCloud (sync engine + photos)', () => {
  const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()

  function device(fake: Fake, entries: Entry[] = [], originals: Record<string, Blob> = {}, thumbs: Record<string, Blob> = {}) {
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
    const store: FileStore = storeOn(fake)
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
    const fake = fakePCloud()
    const A: ImageRef = { hash: await hashBytes(bytes(40, 3)), ext: 'jpg', w: 4, h: 3 }
    const windows = device(fake, [makeEntry('photo from windows', at(8, 9), 'w1', [A])], { [A.hash]: blob(40, 3) }, { [A.hash]: blob(6, 4) })
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

    windows.add('windows offline', at(8, 10), 'w2')
    android.add('android offline', at(8, 10, 5), 'p1')
    android.edit('w1', 'photo from windows, edited on android', at(8, 11))
    await windows.sync()
    await android.sync()
    await windows.sync()
    expect(windows.live()).toEqual(['android offline', 'photo from windows, edited on android', 'windows offline'])
    expect(android.live()).toEqual(windows.live())
    expect(windows.local.entries.get('w1')?.images).toEqual([A])

    const quiet = await windows.sync()
    expect(quiet.report).toEqual({ read: 0, written: 0, removed: 0, updatedLocally: 0 })
  })
})
