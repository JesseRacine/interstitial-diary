import { describe, expect, it, vi } from 'vitest'
import {
  OAuthError, type OAuthProvider, PENDING_MAX_AGE_MS, type PendingSignIn, type PendingStore, beginSignIn, cleanReturnUrl,
  completeSignIn, parseReturn, pkceChallenge, randomString, refreshAccessToken,
} from './oauth'

const provider: OAuthProvider = {
  authorizeUrl: 'https://auth.example.test/oauth2/authorize',
  tokenUrl: 'https://api.example.test/oauth2/token',
  clientId: 'app-key-123',
  authorizeParams: { token_access_type: 'offline' },
}
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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/** A fake token endpoint that records the form fields it was sent. */
function tokenEndpoint(reply: Response) {
  const calls: { url: string; form: URLSearchParams }[] = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), form: new URLSearchParams(String(init?.body)) })
    return reply.clone()
  }) as unknown as typeof fetch
  return { fn, calls }
}

async function started(pending = memoryPending(), now = 1_000_000) {
  const url = new URL(await beginSignIn(provider, 'dropbox', REDIRECT, pending, now))
  return { pending, url, state: url.searchParams.get('state')! }
}

describe('PKCE', () => {
  it('is base64url(SHA-256(verifier)) without padding', async () => {
    // Expected value computed independently: printf %s <verifier> | openssl dgst -sha256 -binary | base64, made URL-safe.
    expect(await pkceChallenge('dBjftJeZ4CVP-mJ92c3qhCwhSZRhuDPYIh7nSqGHkd8')).toBe('LXkhua_oY2BEGPRnRnFkE8gBPttkr1NNd52gdrOZ6tc')
  })

  it('makes URL-safe verifiers of a valid length, different every time', () => {
    const a = randomString(32)
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomString(32)).not.toBe(a)
  })
})

describe('beginSignIn', () => {
  it('builds the authorize URL and remembers the verifier', async () => {
    const { pending, url, state } = await started()
    expect(url.origin + url.pathname).toBe(provider.authorizeUrl)
    const q = url.searchParams
    expect(q.get('client_id')).toBe('app-key-123')
    expect(q.get('redirect_uri')).toBe(REDIRECT)
    expect(q.get('response_type')).toBe('code')
    expect(q.get('code_challenge_method')).toBe('S256')
    expect(q.get('token_access_type')).toBe('offline')
    expect(pending.value).toMatchObject({ backendId: 'dropbox', state, redirectUri: REDIRECT, startedAt: 1_000_000 })
    expect(q.get('code_challenge')).toBe(await pkceChallenge(pending.value!.verifier))
    expect(url.toString()).not.toContain(pending.value!.verifier) // the verifier never leaves the device
  })
})

describe('parseReturn / cleanReturnUrl', () => {
  it('recognises a code, an error, or nothing', () => {
    expect(parseReturn(`${REDIRECT}?code=abc&state=xyz`)).toEqual({ kind: 'code', code: 'abc', state: 'xyz' })
    expect(parseReturn(`${REDIRECT}?error=access_denied&state=xyz`)).toEqual({ kind: 'error', error: 'access_denied', description: '', state: 'xyz' })
    expect(parseReturn(REDIRECT)).toBeNull()
    expect(parseReturn(`${REDIRECT}?code=abc`)).toBeNull() // no state: not ours
  })

  it('removes only the sign-in parameters', () => {
    expect(cleanReturnUrl(`${REDIRECT}?code=abc&state=xyz&keep=1#top`)).toBe(`${REDIRECT}?keep=1#top`)
    expect(cleanReturnUrl(`${REDIRECT}?error=access_denied&error_description=no&state=s`)).toBe(REDIRECT)
  })
})

describe('completeSignIn', () => {
  it('does nothing for an ordinary page load', async () => {
    const { pending } = await started()
    const { fn } = tokenEndpoint(json(200, {}))
    expect(await completeSignIn(provider, REDIRECT, pending, fn)).toBeNull()
    expect(pending.value).not.toBeNull() // still waiting for the real return
    expect(fn).not.toHaveBeenCalled()
  })

  it('exchanges the code with the verifier and returns the tokens', async () => {
    const { pending, state } = await started()
    const verifier = pending.value!.verifier
    const { fn, calls } = tokenEndpoint(json(200, { access_token: 'AT', expires_in: 14400, refresh_token: 'RT', account_id: 'dbid:1' }))
    const r = await completeSignIn(provider, `${REDIRECT}?code=C0DE&state=${state}`, pending, fn, 1_000_000 + 5_000)
    expect(r).toEqual({
      backendId: 'dropbox',
      tokens: {
        accessToken: 'AT', refreshToken: 'RT', expiresAt: 1_005_000 + 14_400_000 - 60_000,
        data: { access_token: 'AT', expires_in: 14400, refresh_token: 'RT', account_id: 'dbid:1' },
      },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe(provider.tokenUrl)
    expect(Object.fromEntries(calls[0].form)).toEqual({
      grant_type: 'authorization_code', code: 'C0DE', code_verifier: verifier, redirect_uri: REDIRECT, client_id: 'app-key-123',
    })
    expect(pending.value).toBeNull()
  })

  it('uses the pending sign-in up, so the same return cannot be finished twice', async () => {
    const { pending, state } = await started()
    const { fn } = tokenEndpoint(json(200, { access_token: 'AT', expires_in: 100 }))
    const href = `${REDIRECT}?code=C0DE&state=${state}`
    await completeSignIn(provider, href, pending, fn, 1_000_000)
    await expect(completeSignIn(provider, href, pending, fn, 1_000_000)).rejects.toThrow(OAuthError)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('rejects a reply whose state does not match, without exchanging the code', async () => {
    const { pending } = await started()
    const { fn } = tokenEndpoint(json(200, { access_token: 'AT' }))
    await expect(completeSignIn(provider, `${REDIRECT}?code=C0DE&state=forged`, pending, fn)).rejects.toThrow(/did not match/)
    expect(fn).not.toHaveBeenCalled()
    expect(pending.value).toBeNull()
  })

  it('reports a cancelled sign-in', async () => {
    const { pending, state } = await started()
    const { fn } = tokenEndpoint(json(200, {}))
    await expect(completeSignIn(provider, `${REDIRECT}?error=access_denied&state=${state}`, pending, fn)).rejects.toThrow('Sign-in was cancelled.')
    expect(fn).not.toHaveBeenCalled()
  })

  it('refuses a sign-in that was started too long ago', async () => {
    const { pending, state } = await started(memoryPending(), 0)
    const { fn } = tokenEndpoint(json(200, { access_token: 'AT' }))
    await expect(completeSignIn(provider, `${REDIRECT}?code=C&state=${state}`, pending, fn, PENDING_MAX_AGE_MS + 1)).rejects.toThrow(/too long/)
    expect(fn).not.toHaveBeenCalled()
  })

  it('reports a failed exchange without leaking the code or verifier', async () => {
    const { pending, state } = await started()
    const verifier = pending.value!.verifier
    const { fn } = tokenEndpoint(json(400, { error: 'invalid_grant', error_description: 'code doesn\'t exist or has expired' }))
    const err = (await completeSignIn(provider, `${REDIRECT}?code=SECRETCODE&state=${state}`, pending, fn, 1_000_000).catch((e: unknown) => e)) as Error
    expect(err).toBeInstanceOf(OAuthError)
    expect(err.message).toContain('invalid_grant')
    expect(err.message).not.toContain('SECRETCODE')
    expect(err.message).not.toContain(verifier)
  })
})

describe('refreshAccessToken', () => {
  it('gets a new access token', async () => {
    const { fn, calls } = tokenEndpoint(json(200, { access_token: 'AT2', expires_in: 14400 }))
    const t = await refreshAccessToken(provider, 'RT', 'Dropbox', fn, 0)
    expect(t.accessToken).toBe('AT2')
    expect(t.refreshToken).toBeUndefined()
    expect(Object.fromEntries(calls[0].form)).toEqual({ grant_type: 'refresh_token', refresh_token: 'RT', client_id: 'app-key-123' })
  })

  it('turns a revoked refresh token into a NotAllowedError (shown as "sign in again")', async () => {
    const { fn } = tokenEndpoint(json(400, { error: 'invalid_grant', error_description: 'refresh token is malformed' }))
    const err = await refreshAccessToken(provider, 'RT', 'Dropbox', fn).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DOMException)
    expect((err as DOMException).name).toBe('NotAllowedError')
    expect((err as DOMException).message).not.toContain('RT')
  })

  it('keeps other failures as ordinary errors (retried by the next sync)', async () => {
    const { fn } = tokenEndpoint(json(503, {}))
    await expect(refreshAccessToken(provider, 'RT', 'Dropbox', fn)).rejects.toThrow(/503/)
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') }) as unknown as typeof fetch
    await expect(refreshAccessToken(provider, 'RT', 'Dropbox', offline)).rejects.toThrow(TypeError)
  })
})
