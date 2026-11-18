import { describe, expect, it } from 'vitest'
import { resumeFromRedirect } from '../resume'
import type { FileStore } from '../types'
import { type OAuthProvider, type PendingSignIn, type PendingStore, beginSignIn, completeSignIn } from './oauth'
import { DEV_FOLDER, type PCloudSession, apiHost, isDevHost, makePCloudBackend } from './pcloud'

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

/** A pCloud module on a given host; records the sign-in page it leaves for and the sessions its stores get. */
function world(host = 'jesseracine.github.io') {
  const pending = memoryPending()
  const sessions: PCloudSession[] = []
  let left = ''
  const backend = makePCloudBackend({
    clientId: 'client-1',
    pending,
    redirectUri: () => REDIRECT,
    hostname: () => host,
    navigate: (url) => { left = url },
    store: (s) => { sessions.push(s); return {} as FileStore },
  })
  const signIn = async () => {
    void backend.setup()
    await new Promise((r) => setTimeout(r, 0))
    return new URL(left)
  }
  return { pending, sessions, backend, signIn }
}

const reply = (state: string, extra = 'locationid=1&hostname=api.pcloud.com') =>
  `${REDIRECT}#access_token=TOK&token_type=bearer&uid=42&state=${state}&${extra}`

describe('pCloud sign-in (token flow)', () => {
  it('sends the browser to pCloud asking for a token, with no PKCE and nothing secret', async () => {
    const w = world()
    const url = await w.signIn()
    expect(url.origin + url.pathname).toBe('https://my.pcloud.com/oauth2/authorize')
    const q = url.searchParams
    expect(Object.fromEntries(q)).toEqual({ client_id: 'client-1', redirect_uri: REDIRECT, response_type: 'token', state: w.pending.value!.state })
  })

  it('finishes from the fragment: saves the token, region host and user id, and cleans the address', async () => {
    const w = world()
    const state = (await w.signIn()).searchParams.get('state')!
    const r = await resumeFromRedirect(reply(state), w.pending, () => w.backend as never)
    expect(r).toMatchObject({ ok: true, backendId: 'pcloud', label: 'pCloud', cleanUrl: REDIRECT })
    expect(r!.ok && r!.config).toEqual({ token: 'TOK', hostname: 'api.pcloud.com', uid: '42' })
    expect(w.sessions).toEqual([{ token: 'TOK', hostname: 'api.pcloud.com', uid: '42', folder: '' }])
    expect(w.pending.value).toBeNull()
  })

  it('refuses a reply whose state does not match, and one that never started', async () => {
    const w = world()
    await w.signIn()
    expect(await resumeFromRedirect(reply('forged'), w.pending, () => w.backend as never)).toMatchObject({ ok: false, message: /did not match/ })
    expect(await resumeFromRedirect(reply('forged'), w.pending, () => w.backend as never)).toMatchObject({ ok: false, cleanUrl: REDIRECT })
    expect(w.sessions).toEqual([])
  })

  it('refuses a token reply to a code-flow sign-in (e.g. Dropbox) and the other way round', async () => {
    const codeProvider: OAuthProvider = { authorizeUrl: 'https://a.test/auth', tokenUrl: 'https://a.test/token', clientId: 'x' }
    const pending = memoryPending()
    const state = new URL(await beginSignIn(codeProvider, 'dropbox', REDIRECT, pending)).searchParams.get('state')!
    await expect(completeSignIn(codeProvider, reply(state), pending)).rejects.toThrow(/expected kind/)

    const w = world()
    const s2 = (await w.signIn()).searchParams.get('state')!
    await expect(w.backend.resumeSetup!(`${REDIRECT}?code=C&state=${s2}`)).rejects.toThrow(/expected kind/)
  })

  it('only ever uses a pCloud API host for the token', () => {
    expect(apiHost({ hostname: 'eapi.pcloud.com', locationid: '2' })).toBe('eapi.pcloud.com')
    expect(apiHost({ hostname: 'evil.example.com', locationid: '1' })).toBe('api.pcloud.com')
    expect(apiHost({ hostname: 'api.pcloud.com.evil.test' })).toBeNull()
    expect(apiHost({})).toBeNull()
  })

  it('reopens a saved sign-in without the network, and refuses a damaged one', async () => {
    const w = world()
    expect(await w.backend.open({ token: 'TOK', hostname: 'api.pcloud.com', uid: '42' }, false)).toMatchObject({ ok: true, label: 'pCloud' })
    expect(await w.backend.open({ token: 'TOK', hostname: 'evil.example.com', uid: '42' }, false)).toMatchObject({ ok: false })
    expect(await w.backend.open(null as never, false)).toMatchObject({ ok: false })
  })
})

describe('pCloud on a development address', () => {
  it('knows the development addresses, and that the native apps (tauri.localhost) are not one', () => {
    for (const h of ['localhost', '127.0.0.1', '[::1]']) expect(isDevHost(h)).toBe(true)
    for (const h of ['tauri.localhost', 'jesseracine.github.io', 'localhost.example.com']) expect(isDevHost(h)).toBe(false)
  })

  it('always works in the development folder there, never the real journal', async () => {
    const w = world('localhost')
    const state = (await w.signIn()).searchParams.get('state')!
    const r = await w.backend.resumeSetup!(reply(state))
    expect(r.label).toBe('pCloud (development folder)')
    expect(r.config).not.toHaveProperty('folder') // decided by the address every time, never saved
    await w.backend.open(r.config, false)
    expect(w.sessions.map((s) => s.folder)).toEqual([DEV_FOLDER, DEV_FOLDER])
    expect(w.backend.description).toContain(DEV_FOLDER)
  })
})
