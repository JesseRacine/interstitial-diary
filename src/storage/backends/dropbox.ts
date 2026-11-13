import { metaPending } from '../oauthPending'
import type { StorageBackend } from '../types'
import { dropboxStore, refreshingToken } from './dropbox-store'
import { OAuthError, type OAuthProvider, type PendingStore, beginSignIn, completeSignIn, refreshAccessToken } from './oauth'

/**
 * The Dropbox app's App key: a public identifier (not a secret), from the Dropbox App Console. Empty until the app is
 * registered; the module then shows as not available. Never put the App secret or any token in this repository.
 */
export const DROPBOX_APP_KEY: string = 'ebolibsz2jounxf'

/** What is saved (in IndexedDB) for a connected Dropbox. The access token is never saved; it is fetched when needed. */
export interface DropboxConfig {
  refreshToken: string
  accountId: string
}

export interface DropboxDeps {
  appKey: string
  pending: PendingStore
  fetch?: typeof fetch
  /** Where Dropbox sends the browser back to; must be registered in the App Console exactly. */
  redirectUri: () => string
  /** Leaves the page for Dropbox's sign-in page. */
  navigate: (url: string) => void
}

const ID = 'dropbox'
const LABEL = 'Dropbox'

export const dropboxProvider = (appKey: string): OAuthProvider => ({
  authorizeUrl: 'https://www.dropbox.com/oauth2/authorize',
  tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
  clientId: appKey,
  authorizeParams: { token_access_type: 'offline' }, // also returns a refresh token, so the app stays signed in
})

const isConfig = (c: unknown): c is DropboxConfig =>
  !!c && typeof c === 'object' && typeof (c as DropboxConfig).refreshToken === 'string' && !!(c as DropboxConfig).refreshToken

export function makeDropboxBackend(deps: DropboxDeps): StorageBackend<DropboxConfig> {
  const provider = dropboxProvider(deps.appKey)
  const fetchFn = deps.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))

  const storeFor = (config: DropboxConfig) =>
    dropboxStore({
      token: refreshingToken(() => refreshAccessToken(provider, config.refreshToken, LABEL, fetchFn)),
      fetch: fetchFn,
    })

  return {
    id: ID,
    name: LABEL,
    description:
      'Saves the Markdown files and photos in your Dropbox (in Apps/, in this app’s own folder only), so Windows and Android share one journal. You sign in on Dropbox’s own page.',

    unsupportedReason() {
      if (!deps.appKey) return 'Not set up in this version yet.'
      return typeof crypto !== 'undefined' && crypto.subtle ? null : 'Needs a secure (https) page.'
    },

    async setup() {
      deps.navigate(await beginSignIn(provider, ID, deps.redirectUri(), deps.pending))
      return new Promise<never>(() => {}) // the page is leaving; resumeSetup finishes when it comes back
    },

    async resumeSetup(href) {
      const r = await completeSignIn(provider, href, deps.pending, fetchFn)
      if (!r) throw new OAuthError('Nothing to finish: this page is not a return from Dropbox.')
      const refreshToken = r.tokens.refreshToken
      if (!refreshToken) throw new OAuthError('Dropbox did not allow staying signed in. Please try again.')
      const accountId = typeof r.tokens.data.account_id === 'string' ? r.tokens.data.account_id : ''
      const config: DropboxConfig = { refreshToken, accountId }
      return { config, store: storeFor(config), label: LABEL }
    },

    // Needs no network: the access token is fetched by the first call, so an offline start still opens (and the sync
    // reports the error and retries later). A revoked sign-in shows up there as "needs permission".
    async open(config) {
      if (!isConfig(config)) return { ok: false, reason: 'unavailable', message: 'Saved Dropbox sign-in not found. Choose Dropbox again.' }
      return { ok: true, store: storeFor(config), label: LABEL }
    },
  }
}

/** The app folder's URL, e.g. https://jesseracine.github.io/interstitial-diary/ or http://localhost:5173/. */
const appUrl = () => new URL(import.meta.env.BASE_URL, location.origin).href

export const dropboxBackend = makeDropboxBackend({
  appKey: DROPBOX_APP_KEY,
  pending: metaPending,
  redirectUri: appUrl,
  navigate: (url) => location.assign(url),
})
