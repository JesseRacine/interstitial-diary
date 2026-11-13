import 'fake-indexeddb/auto' // dropbox.ts also builds the app's own instance, which uses the database
import { describe, expect, it } from 'vitest'
import { memoryLocal } from '../memory'
import { resumeFromRedirect } from '../resume'
import { emptySyncState, syncOnce } from '../sync'
import type { StorageBackend } from '../types'
import { type DropboxConfig, dropboxBackend, makeDropboxBackend } from './dropbox'
import { fakeDropbox } from './fake-dropbox'
import type { PendingSignIn, PendingStore } from './oauth'
import { makeEntry } from '../../lib/entry'

const REDIRECT = 'https://app.example.test/diary/'

function memoryPending(): PendingStore & { value: PendingSignIn | null } {
  const s = {
    value: null as PendingSignIn | null,
    get: async () => s.value,
    set: async (p: PendingSignIn) => { s.value = p },
    clear: async () => { s.value = null },
  }
  return s
}

/** A fake Dropbox plus a fake token endpoint that hands out its current access token. */
function world(tokenReply?: (form: URLSearchParams) => Response) {
  const fake = fakeDropbox()
  const tokenCalls: URLSearchParams[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    if (String(input) === 'https://api.dropboxapi.com/oauth2/token') {
      const form = new URLSearchParams(String(init?.body))
      tokenCalls.push(form)
      if (tokenReply) return tokenReply(form)
      const body: Record<string, unknown> = { access_token: fake.token, expires_in: 14400, token_type: 'bearer' }
      if (form.get('grant_type') === 'authorization_code') Object.assign(body, { refresh_token: 'RT-1', account_id: 'dbid:abc' })
      return new Response(JSON.stringify(body), { status: 200 })
    }
    return fake.fetch(input, init)
  }) as typeof fetch
  const pending = memoryPending()
  const navigated: string[] = []
  const backend = makeDropboxBackend({
    appKey: 'key123', pending, fetch: fetchFn, redirectUri: () => REDIRECT, navigate: (u) => { navigated.push(u) },
  })
  return { fake, backend, pending, navigated, tokenCalls }
}

/** Start the sign-in and return the URL Dropbox would send the browser back to. */
async function signInReturn(w: ReturnType<typeof world>, code = 'CODE') {
  void w.backend.setup() // never resolves: the page would be leaving
  await new Promise((r) => setTimeout(r, 0))
  const state = new URL(w.navigated[0]).searchParams.get('state')
  return `${REDIRECT}?code=${code}&state=${state}`
}

describe('the Dropbox module', () => {
  it('is not offered until the App key is set (it is empty in this version)', () => {
    expect(dropboxBackend.unsupportedReason()).toMatch(/Not set up/)
    expect(world().backend.unsupportedReason()).toBeNull()
  })

  it('setup sends the browser to Dropbox with PKCE and offline access, for this app folder', async () => {
    const w = world()
    await signInReturn(w)
    const url = new URL(w.navigated[0])
    expect(url.origin + url.pathname).toBe('https://www.dropbox.com/oauth2/authorize')
    expect(url.searchParams.get('client_id')).toBe('key123')
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT)
    expect(url.searchParams.get('token_access_type')).toBe('offline')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(w.pending.value?.backendId).toBe('dropbox')
  })

  it('finishing the return saves only the refresh token and account, and the store works', async () => {
    const w = world()
    const r = await w.backend.resumeSetup!(await signInReturn(w))
    expect(r.config).toEqual({ refreshToken: 'RT-1', accountId: 'dbid:abc' })
    expect(JSON.stringify(r.config)).not.toContain(w.fake.token) // the access token is never saved
    expect(r.label).toBe('Dropbox')
    await r.store.write('2026/2026-11-08.md', 'hello')
    expect(w.fake.text('/2026/2026-11-08.md')).toBe('hello')
    expect(w.tokenCalls.map((f) => f.get('grant_type'))).toEqual(['authorization_code', 'refresh_token'])
  })

  it('refuses a sign-in that gave no refresh token', async () => {
    const w = world(() => new Response(JSON.stringify({ access_token: 'AT', expires_in: 100 }), { status: 200 }))
    await expect(w.backend.resumeSetup!(await signInReturn(w))).rejects.toThrow(/staying signed in/)
  })

  it('opens a saved config without going online; a broken config is reported', async () => {
    const w = world()
    const r = await w.backend.open({ refreshToken: 'RT-1', accountId: 'x' }, false)
    expect(r.ok).toBe(true)
    expect(w.tokenCalls).toHaveLength(0)
    expect(await w.backend.open({} as DropboxConfig, false)).toMatchObject({ ok: false, reason: 'unavailable' })
  })

  it('a revoked sign-in turns into "needs permission" at the next sync', async () => {
    const w = world(() => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }))
    const r = await w.backend.open({ refreshToken: 'revoked', accountId: 'x' }, false)
    if (!r.ok) throw new Error('should open')
    const err = await syncOnce(memoryLocal([]), r.store, emptySyncState()).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('NotAllowedError') // manager.ts shows this as "needs permission"
  })
})

describe('resumeFromRedirect (startup)', () => {
  const lookupFor = (b: StorageBackend<DropboxConfig>) => (id: string) => (id === b.id ? (b as StorageBackend<unknown>) : undefined)

  it('does nothing on an ordinary page load', async () => {
    const w = world()
    expect(await resumeFromRedirect(REDIRECT, w.pending, lookupFor(w.backend))).toBeNull()
    expect(await resumeFromRedirect(`${REDIRECT}?q=tag`, w.pending, lookupFor(w.backend))).toBeNull()
  })

  it('finishes the sign-in that was started, and gives a clean URL to show', async () => {
    const w = world()
    const href = `${(await signInReturn(w))}&keep=1`
    const r = await resumeFromRedirect(href, w.pending, lookupFor(w.backend))
    expect(r).toMatchObject({ ok: true, backendId: 'dropbox', label: 'Dropbox', cleanUrl: `${REDIRECT}?keep=1` })
    expect(w.pending.value).toBeNull()
  })

  it('a second load of the same return (e.g. a reload before the URL was cleaned) does not sign in twice', async () => {
    const w = world()
    const href = await signInReturn(w)
    await resumeFromRedirect(href, w.pending, lookupFor(w.backend))
    const again = await resumeFromRedirect(href, w.pending, lookupFor(w.backend))
    expect(again).toMatchObject({ ok: false, cleanUrl: REDIRECT })
    expect(w.tokenCalls.filter((f) => f.get('grant_type') === 'authorization_code')).toHaveLength(1)
  })

  it('reports a cancelled sign-in, and the old storage stays as it was', async () => {
    const w = world()
    void w.backend.setup()
    await new Promise((r) => setTimeout(r, 0))
    const state = new URL(w.navigated[0]).searchParams.get('state')
    const r = await resumeFromRedirect(`${REDIRECT}?error=access_denied&state=${state}`, w.pending, lookupFor(w.backend))
    expect(r).toEqual({ ok: false, message: 'Sign-in was cancelled.', cleanUrl: REDIRECT })
  })

  it('reports a pending sign-in for a module that no longer exists', async () => {
    const w = world()
    const href = await signInReturn(w)
    const r = await resumeFromRedirect(href, w.pending, () => undefined)
    expect(r).toMatchObject({ ok: false, message: 'Unknown storage “dropbox”.' })
    expect(w.pending.value).toBeNull()
  })

  it('end to end: two devices sign in to the same Dropbox and share an entry', async () => {
    const w = world()
    const a = await resumeFromRedirect(await signInReturn(w), w.pending, lookupFor(w.backend))
    w.navigated.length = 0
    const b = await resumeFromRedirect(await signInReturn(w, 'CODE2'), w.pending, lookupFor(w.backend))
    if (!a?.ok || !b?.ok) throw new Error('both should sign in')
    const one = memoryLocal([makeEntry('from windows', new Date(2026, 10, 8, 9).getTime(), 'w1')])
    const two = memoryLocal([])
    await syncOnce(one, a.store, emptySyncState())
    await syncOnce(two, b.store, emptySyncState())
    expect([...two.entries.values()].map((e) => e.text)).toEqual(['from windows'])
  })
})
