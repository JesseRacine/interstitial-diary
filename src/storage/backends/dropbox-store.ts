import { BlobCollisionError, type RemovableBlobStore, type StoredFile } from '../types'
import { isDiaryFile, isImagePath } from './fs-store'
import { type TokenResponse, signedOutError } from './oauth'

/*
 * A FileStore over Dropbox's HTTP API (v2), inside the app's own folder (Apps/<app name>/). Store paths like
 * "2026/2026-11-08.md" become Dropbox paths "/2026/2026-11-08.md"; the app folder's root is "".
 * Facts from docs.dropboxapi.com (read 2026-11-12): RPC calls take a JSON body; upload/download take their arguments
 * in the Dropbox-API-Arg header (non-ASCII as \uXXXX); endpoint errors are 409 with an `error_summary` to match by
 * prefix; 401 `expired_access_token` means get a new token; 429 says how long to wait in Retry-After; one upload is at
 * most 150 MiB. Paths are case-insensitive.
 */

const RPC = 'https://api.dropboxapi.com/2/'
const CONTENT = 'https://content.dropboxapi.com/2/'
const NAME = 'Dropbox'

/** Returns an access token; `fresh` asks for a new one (the last one was refused). */
export type TokenSource = (fresh: boolean) => Promise<string>

/**
 * Keeps the current access token in memory and gets a new one through `refresh` when it is about to expire or was
 * refused. Concurrent callers share one refresh.
 */
export function refreshingToken(refresh: () => Promise<TokenResponse>, now: () => number = Date.now): TokenSource {
  let current: TokenResponse | null = null
  let pending: Promise<TokenResponse> | null = null
  return async (fresh) => {
    if (!fresh && current && now() < current.expiresAt) return current.accessToken
    if (fresh) current = null
    pending ??= refresh().finally(() => { pending = null })
    current = await pending
    return current.accessToken
  }
}

export class DropboxError extends Error {
  readonly status: number
  readonly summary: string
  constructor(status: number, summary: string, what: string) {
    super(summary.startsWith('path/insufficient_space')
      ? 'Your Dropbox is full.'
      : `${NAME} could not ${what} (${status}${summary ? ` ${summary}` : ''}).`)
    this.name = 'DropboxError'
    this.status = status
    this.summary = summary
  }
}

/** JSON that is safe in an HTTP header: non-ASCII characters and DEL as \uXXXX. */
export const headerJson = (v: unknown) =>
  JSON.stringify(v).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)

const dbxPath = (path: string) => `/${path}`

interface FileMeta {
  '.tag': 'file' | 'folder' | 'deleted'
  name: string
  path_lower?: string
  path_display?: string
  size?: number
  rev?: string
  content_hash?: string | null
}

/** Same content → same rev on every device (content_hash); `rev` only if Dropbox ever leaves the hash out. */
const revOf = (m: FileMeta) => m.content_hash || m.rev || ''

export interface DropboxStoreOptions {
  token: TokenSource
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** How many times one call waits and tries again after 429/503 (default 4). */
  retries?: number
}

export function dropboxStore(opts: DropboxStoreOptions): RemovableBlobStore {
  const fetchFn = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a))
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const retries = opts.retries ?? 4

  /** One call, with a new token once after a 401 and waits after 429/503. Returns the final response. */
  async function send(url: string, init: (token: string) => RequestInit): Promise<Response> {
    let fresh = false
    let refreshed = false
    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(url, init(await opts.token(fresh)))
      fresh = false
      if (res.status === 401) {
        const summary = await errorSummary(res)
        if (!refreshed && /^(expired_access_token|invalid_access_token)/.test(summary)) {
          refreshed = fresh = true
          continue
        }
        throw signedOutError(NAME)
      }
      if ((res.status === 429 || res.status === 503) && attempt < retries) {
        const after = Number(res.headers.get('Retry-After'))
        await sleep(Number.isFinite(after) && after > 0 ? Math.min(after, 60) * 1000 : 1000 * 2 ** attempt)
        continue
      }
      return res
    }
  }

  const rpc = (endpoint: string, arg: unknown) =>
    send(RPC + endpoint, (t) => ({
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(arg),
    }))

  const content = (endpoint: string, arg: unknown, body?: Blob | Uint8Array<ArrayBuffer>) =>
    send(CONTENT + endpoint, (t) => ({
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t}`,
        'Dropbox-API-Arg': headerJson(arg),
        ...(body ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      body,
    }))

  /** The response if it is OK, null for a 409 whose summary starts with one of `ok409`, else throws. */
  async function expect(res: Response, what: string, ok409: string[] = []): Promise<Response | null> {
    if (res.ok) return res
    const summary = await errorSummary(res)
    if (res.status === 409 && ok409.some((p) => summary.startsWith(p))) return null
    throw new DropboxError(res.status, summary, what)
  }

  /** Every entry of one folder (following has_more); a missing folder is empty. */
  async function listFolder(path: string): Promise<FileMeta[]> {
    const out: FileMeta[] = []
    const first = await expect(await rpc('files/list_folder', { path, recursive: false }), 'list the folder', ['path/not_found'])
    if (!first) return out
    let page = (await first.json()) as { entries: FileMeta[]; cursor: string; has_more: boolean }
    out.push(...page.entries)
    while (page.has_more) {
      const next = await expect(await rpc('files/list_folder/continue', { cursor: page.cursor }), 'list the folder')
      page = (await next!.json()) as typeof page
      out.push(...page.entries)
    }
    return out
  }

  async function download(path: string): Promise<Response | null> {
    return expect(await content('files/download', { path: dbxPath(path) }), `read ${path}`, ['path/not_found'])
  }

  async function upload(path: string, body: Blob | Uint8Array<ArrayBuffer>, mode: 'add' | 'overwrite'): Promise<FileMeta | null> {
    const res = await expect(
      await content('files/upload', { path: dbxPath(path), mode, autorename: false, mute: true }, body),
      `save ${path}`,
      mode === 'add' ? ['path/conflict'] : [],
    )
    return res ? ((await res.json()) as FileMeta) : null
  }

  async function del(path: string): Promise<void> {
    await expect(await rpc('files/delete_v2', { path: dbxPath(path) }), `delete ${path}`, ['path_lookup/not_found'])
  }

  async function hasBlob(path: string): Promise<{ size: number } | null> {
    const res = await expect(await rpc('files/get_metadata', { path: dbxPath(path) }), `check ${path}`, ['path/not_found'])
    if (!res) return null
    const m = (await res.json()) as FileMeta
    return m['.tag'] === 'file' ? { size: m.size ?? 0 } : null
  }

  return {
    // Lists the root, then only the year folders and .meta, one level each: image folders are never walked.
    async list() {
      const out: StoredFile[] = []
      const root = await listFolder('')
      for (const f of root) {
        if (f['.tag'] !== 'folder' || !(/^\d{4}$/.test(f.name) || f.name === '.meta')) continue
        for (const m of await listFolder(f.path_lower ?? dbxPath(f.name))) {
          const path = `${f.name}/${m.name}`
          if (m['.tag'] === 'file' && isDiaryFile(path)) out.push({ path, rev: revOf(m) })
        }
      }
      return out
    },
    async read(path) {
      const res = await download(path)
      return res ? res.text() : null
    },
    async write(path, text) {
      const m = await upload(path, new TextEncoder().encode(text), 'overwrite')
      return revOf(m!)
    },
    async remove(path) {
      await del(path)
    },
    async readBlob(path) {
      const res = await download(path)
      return res ? res.blob() : null
    },
    hasBlob,
    async writeBlob(path, blob) {
      const existing = await hasBlob(path)
      if (existing) {
        if (existing.size === blob.size) return
        throw new BlobCollisionError(path, existing.size, blob.size)
      }
      if (await upload(path, blob, 'add')) return
      // Another device wrote it in the meantime ('add' never overwrites): the same check as above.
      const now = await hasBlob(path)
      if (now?.size === blob.size) return
      throw new BlobCollisionError(path, now?.size ?? 0, blob.size)
    },
    async removeBlob(path) {
      if (!isImagePath(path)) throw new Error(`Not an image path: ${path}`)
      await del(path)
    },
  }
}

async function errorSummary(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error_summary?: unknown } | null
  return typeof body?.error_summary === 'string' ? body.error_summary : ''
}
