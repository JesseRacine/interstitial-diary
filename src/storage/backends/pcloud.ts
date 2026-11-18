import type { FileStore, StorageBackend } from '../types'
import { OAuthError, type OAuthProvider, type PendingStore, beginSignIn, completeSignIn } from './oauth'

/*
 * The pCloud storage module (pcloud-plan.md). Sign-in is pCloud's OAuth token flow: no secret, the token comes back in
 * the URL fragment together with the account's region (`hostname`, the API host every later call goes to), and it does
 * not expire. The app is registered with access to its own folder only.
 *
 * Development safety: on a development address (localhost) the module always works in a separate subfolder,
 * DEV_FOLDER, so a test can never touch the real journal's files even when signed in to the real account (the Dropbox
 * module once synced localhost with the real journal, 2026-11-17).
 */

/** The pCloud app's Client ID: a public identifier, not a secret. Never put the app secret or any token in this repository. */
export const PCLOUD_CLIENT_ID: string = '8rKcvw6AboV'

/** The subfolder (of the app folder) used on development addresses instead of the real journal. */
export const DEV_FOLDER = 'dev-localhost'

/** What is saved (in IndexedDB) for a connected pCloud. The token does not expire; it never goes into a log or message. */
export interface PCloudConfig {
  token: string
  /** The API host for this account's region, e.g. api.pcloud.com (US) or eapi.pcloud.com (Europe). */
  hostname: string
  uid: string
}

/** What the file store needs: the saved sign-in plus the folder to work in ('' = the app folder itself). */
export interface PCloudSession extends PCloudConfig {
  folder: string
}

export interface PCloudDeps {
  clientId: string
  pending: PendingStore
  /** Where pCloud sends the browser back to; must be one of the redirect URIs registered with the app. */
  redirectUri: () => string
  /** The page's host name, to tell a development address from the real app. */
  hostname: () => string
  /** Leaves the page for pCloud's sign-in page. */
  navigate: (url: string) => void
  /** The FileStore for a session (pcloud-store.ts). */
  store: (session: PCloudSession) => FileStore
}

const ID = 'pcloud'
const LABEL = 'pCloud'

export const pcloudProvider = (clientId: string): OAuthProvider => ({
  authorizeUrl: 'https://my.pcloud.com/oauth2/authorize',
  tokenUrl: '', // the token flow has no token endpoint
  clientId,
  flow: 'token',
})

/**
 * A development address: the dev server and the local preview builds. Not `tauri.localhost`: that is the native apps'
 * real address, and they hold the user's real journal.
 */
export const isDevHost = (host: string) => ['localhost', '127.0.0.1', '[::1]', '::1'].includes(host.toLowerCase())

/** Only ever a pCloud API host, so the token can never be sent anywhere else. */
const API_HOST = /^[a-z0-9-]+\.pcloud\.com$/i
const HOST_BY_LOCATION: Record<string, string> = { '1': 'api.pcloud.com', '2': 'eapi.pcloud.com' }

/** The API host from the sign-in reply: its `hostname` if it is a pCloud host, else by `locationid` (1 US, 2 Europe). */
export function apiHost(data: Record<string, unknown>): string | null {
  const host = typeof data.hostname === 'string' ? data.hostname.trim().toLowerCase() : ''
  if (API_HOST.test(host)) return host
  return HOST_BY_LOCATION[String(data.locationid ?? '')] ?? null
}

const isConfig = (c: unknown): c is PCloudConfig => {
  const x = c as PCloudConfig
  return !!c && typeof c === 'object' && typeof x.token === 'string' && !!x.token && typeof x.hostname === 'string' && API_HOST.test(x.hostname)
}

export function makePCloudBackend(deps: PCloudDeps): StorageBackend<PCloudConfig> {
  const provider = pcloudProvider(deps.clientId)
  const dev = () => isDevHost(deps.hostname())
  const label = () => (dev() ? `${LABEL} (development folder)` : LABEL)
  // Decided from the page's address every time, never saved: a config made on localhost stays on localhost (each
  // address has its own database), and the real app can never be switched to the development folder or back.
  const storeFor = (config: PCloudConfig) => deps.store({ ...config, folder: dev() ? DEV_FOLDER : '' })

  return {
    id: ID,
    name: LABEL,
    get description() {
      return dev()
        ? `Development address: uses only the “${DEV_FOLDER}” folder inside this app’s pCloud folder, never your real journal. You sign in on pCloud’s own page.`
        : 'Saves the Markdown files and photos in your pCloud (in this app’s own folder only), so Windows and Android share one journal. You sign in on pCloud’s own page.'
    },

    unsupportedReason() {
      return deps.clientId ? null : 'Not set up in this version yet.'
    },

    async setup() {
      deps.navigate(await beginSignIn(provider, ID, deps.redirectUri(), deps.pending))
      return new Promise<never>(() => {}) // the page is leaving; resumeSetup finishes when it comes back
    },

    async resumeSetup(href) {
      const r = await completeSignIn(provider, href, deps.pending)
      if (!r) throw new OAuthError('Nothing to finish: this page is not a return from pCloud.')
      const hostname = apiHost(r.tokens.data)
      if (!hostname) throw new OAuthError('pCloud did not say which region your account is in. Please try again.')
      const uid = r.tokens.data.uid
      const config: PCloudConfig = { token: r.tokens.accessToken, hostname, uid: typeof uid === 'string' ? uid : '' }
      return { config, store: storeFor(config), label: label() }
    },

    // Needs no network: an offline start still opens; a token that stopped working shows up in the first sync as
    // "needs permission".
    async open(config) {
      if (!isConfig(config)) return { ok: false, reason: 'unavailable', message: 'Saved pCloud sign-in not found. Choose pCloud again.' }
      return { ok: true, store: storeFor(config), label: label() }
    },
  }
}
