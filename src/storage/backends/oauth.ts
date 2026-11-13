/*
 * OAuth 2 sign-in for cloud storage modules: the authorization-code flow with PKCE (RFC 7636), for a browser app that
 * has no client secret. Used by Dropbox; meant to be reused by later modules.
 *
 * The sign-in leaves the page (a full-page redirect, which also works from an installed Android app), so what is needed
 * to finish it (the PKCE verifier and the `state`) is kept in a PendingStore: in the app that is the IndexedDB meta
 * table, shared by every tab and the installed app of the same origin, so the return can be finished wherever it lands.
 *
 * Nothing here logs or puts a token into an error message.
 */

export interface OAuthProvider {
  authorizeUrl: string
  tokenUrl: string
  clientId: string
  /** Extra query parameters for the authorize page, e.g. { token_access_type: 'offline' } for Dropbox. */
  authorizeParams?: Record<string, string>
}

/** A sign-in that was started and not finished yet. */
export interface PendingSignIn {
  backendId: string
  state: string
  verifier: string
  redirectUri: string
  startedAt: number
}

export interface PendingStore {
  get(): Promise<PendingSignIn | null>
  set(p: PendingSignIn): Promise<void>
  clear(): Promise<void>
}

export interface TokenResponse {
  accessToken: string
  /** ms since epoch; a little early, so a token is never used right at its expiry. */
  expiresAt: number
  refreshToken?: string
  /** The provider's whole JSON reply (e.g. Dropbox's account_id). */
  data: Record<string, unknown>
}

/** A started sign-in older than this is not finished any more (the user has to start again). */
export const PENDING_MAX_AGE_MS = 30 * 60_000
/** Access tokens are treated as expired this long before they really do. */
const EXPIRY_MARGIN_MS = 60_000

export class OAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OAuthError'
  }
}

/** The refresh token no longer works (revoked, or the app was removed): the user has to sign in again. */
export const signedOutError = (what: string) =>
  new DOMException(`${what} needs you to sign in again.`, 'NotAllowedError') // manager.ts shows this as "needs permission"

export function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A random URL-safe string from `bytes` random bytes (32 bytes → 43 characters, a valid PKCE verifier). */
export function randomString(bytes = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** The S256 code challenge for a verifier. */
export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

/**
 * Start a sign-in: remember the verifier and state, and return the provider's sign-in page to send the browser to.
 * (A newer sign-in replaces an unfinished older one.)
 */
export async function beginSignIn(
  provider: OAuthProvider, backendId: string, redirectUri: string, pending: PendingStore, now = Date.now(),
): Promise<string> {
  const verifier = randomString(32)
  const state = randomString(16)
  await pending.set({ backendId, state, verifier, redirectUri, startedAt: now })
  const url = new URL(provider.authorizeUrl)
  const params: Record<string, string> = {
    client_id: provider.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    code_challenge: await pkceChallenge(verifier),
    code_challenge_method: 'S256',
    state,
    ...provider.authorizeParams,
  }
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

const RETURN_PARAMS = ['code', 'state', 'error', 'error_description']

export type SignInReturn =
  | { kind: 'code'; code: string; state: string }
  | { kind: 'error'; error: string; description: string; state: string | null }

/** The sign-in result in a URL the provider sent the browser back to, or null if the URL is not such a return. */
export function parseReturn(href: string): SignInReturn | null {
  const q = new URL(href).searchParams
  const code = q.get('code')
  const state = q.get('state')
  if (code && state) return { kind: 'code', code, state }
  const error = q.get('error')
  if (error) return { kind: 'error', error, description: q.get('error_description') ?? '', state }
  return null
}

/** The URL without the sign-in parameters (for history.replaceState, so a reload doesn't try to finish again). */
export function cleanReturnUrl(href: string): string {
  const url = new URL(href)
  for (const p of RETURN_PARAMS) url.searchParams.delete(p)
  return url.toString()
}

/**
 * Finish a sign-in if `href` is a return from the provider. Returns null when it isn't (nothing to do), the tokens and
 * the module's id when it worked, and throws OAuthError when it can't be finished (denied, expired, wrong state).
 * The pending sign-in is used up either way, so a code can only be exchanged once.
 */
export async function completeSignIn(
  provider: OAuthProvider, href: string, pending: PendingStore, fetchFn: typeof fetch = fetch, now = Date.now(),
): Promise<{ backendId: string; tokens: TokenResponse } | null> {
  const ret = parseReturn(href)
  if (!ret) return null
  const p = await pending.get()
  await pending.clear()
  if (!p) throw new OAuthError('This sign-in was not started here, or it was already finished. Please try again.')
  if (ret.state !== p.state) throw new OAuthError('The sign-in reply did not match the sign-in that was started. Please try again.')
  if (ret.kind === 'error') {
    throw new OAuthError(ret.error === 'access_denied' ? 'Sign-in was cancelled.' : `Sign-in failed: ${ret.description || ret.error}`)
  }
  if (now - p.startedAt > PENDING_MAX_AGE_MS) throw new OAuthError('The sign-in took too long. Please try again.')
  const tokens = await tokenRequest(provider, {
    grant_type: 'authorization_code',
    code: ret.code,
    code_verifier: p.verifier,
    redirect_uri: p.redirectUri,
  }, fetchFn, now)
  return { backendId: p.backendId, tokens }
}

/** A new access token from a refresh token. A refresh token that no longer works throws `signedOutError`. */
export async function refreshAccessToken(
  provider: OAuthProvider, refreshToken: string, what: string, fetchFn: typeof fetch = fetch, now = Date.now(),
): Promise<TokenResponse> {
  try {
    return await tokenRequest(provider, { grant_type: 'refresh_token', refresh_token: refreshToken }, fetchFn, now)
  } catch (e) {
    if (e instanceof TokenEndpointError && e.code === 'invalid_grant') throw signedOutError(what)
    throw e
  }
}

class TokenEndpointError extends OAuthError {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, description: string) {
    super(`Sign-in server answered ${status}${code ? ` (${code}${description ? `: ${description}` : ''})` : ''}.`)
    this.status = status
    this.code = code
  }
}

async function tokenRequest(
  provider: OAuthProvider, params: Record<string, string>, fetchFn: typeof fetch, now: number,
): Promise<TokenResponse> {
  const res = await fetchFn(provider.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...params, client_id: provider.clientId }).toString(),
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const str = (v: unknown) => (typeof v === 'string' ? v : '')
    throw new TokenEndpointError(res.status, str(data.error), str(data.error_description))
  }
  if (typeof data.access_token !== 'string' || !data.access_token) throw new OAuthError('The sign-in server sent no access token.')
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600
  return {
    accessToken: data.access_token,
    expiresAt: now + Math.max(0, expiresIn * 1000 - EXPIRY_MARGIN_MS),
    refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : undefined,
    data,
  }
}
