import { BlobCollisionError, type ChangeCheck, type RemovableBlobStore, type StoredFile, isAppFolder } from '../types'
import { isDiaryFile, isImagePath } from './fs-store'
import { signedOutError } from './oauth'
import type { PCloudSession } from './pcloud'
import { bodyBytes, fetchWithTimeout } from './timeout'

/*
 * A FileStore over pCloud's HTTP JSON API (pcloud-plan.md), inside the app's folder, or inside its DEV_FOLDER subfolder
 * on a development address. Store paths like "2026/2026-11-08.md" become pCloud paths "/2026/2026-11-08.md" (or
 * "/dev-localhost/2026/2026-11-08.md").
 *
 * Facts from docs.pcloud.com (read 2026-11-17): every call is `https://<hostname>/<method>?…`; CORS allows any origin but
 * no custom headers, so the token goes as the `access_token` parameter and uploads are a plain multipart POST (no
 * preflight). Errors come as HTTP 200 with `result` ≠ 0. Uploads do not create folders (2005) and overwrite by default
 * (pCloud keeps the old file as a revision); `renameifexists` never overwrites. `hash` is a content hash.
 *
 * Not settled until the first real try (plan step 3): whether `getfilelink` works from a web page (its docs say the
 * referrer must be pcloud.com; requests here send no referrer), and whether "/" is the app folder for this app's token.
 */

const NAME = 'pCloud'

/** pCloud's result codes that matter here (docs.pcloud.com/errors). */
const SIGNED_OUT = new Set([1000, 2000, 2094]) // log in required / log in failed / invalid access_token
const NOT_FOUND = [2002, 2005, 2009] // a parent folder missing / folder missing / file missing
const OVER_QUOTA = 2008
const retryable = (code: number) => code >= 4000 && code < 6000 // 4xxx: slow down; 5xxx: the server's trouble

export class PCloudError extends Error {
  readonly code: number
  constructor(code: number, message: string, what: string) {
    super(code === OVER_QUOTA ? 'Your pCloud is full.' : `${NAME} could not ${what} (${code}${message ? ` ${message}` : ''}).`)
    this.name = 'PCloudError'
    this.code = code
  }
}

interface Meta {
  name: string
  isfolder: boolean
  size?: number
  hash?: number | string
  fileid?: number
  contents?: Meta[]
}

type Reply = Record<string, unknown> & { result: number }

/** The same content gives the same hash on every device; the size makes it safe even if JSON rounded a large hash. */
const revOf = (m: Meta) => `${m.hash ?? ''}:${m.size ?? 0}`

export interface PCloudStoreOptions {
  session: PCloudSession
  fetch?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  /** How many times one call waits and tries again when pCloud says to slow down or has trouble (default 4). */
  retries?: number
}

/** Small calls answer quickly; uploads and downloads move whole photos, plus time for the bytes (at least 20 KB/s). */
function requestTimeoutMs(url: string, init?: RequestInit): number {
  const download = !url.includes('access_token=') // a file link from getfilelink: the only request without our token
  return download || url.includes('/uploadfile?') ? 120_000 + Math.ceil(bodyBytes(init?.body) / 20) : 45_000
}

export function pcloudStore(opts: PCloudStoreOptions): RemovableBlobStore {
  const { session } = opts
  const fetchFn = fetchWithTimeout(opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a)), NAME, requestTimeoutMs)
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const retries = opts.retries ?? 4
  const root = session.folder ? `/${session.folder}` : ''
  const full = (path: string) => `${root}/${path}`
  const rootPath = root || '/'
  // No referrer (getfilelink refuses web pages by referrer) and no cookies: nothing but the parameters identifies us.
  const base: RequestInit = { referrerPolicy: 'no-referrer', credentials: 'omit' }

  /**
   * One API call. Returns the reply, or null when its result is one of `okCodes` (e.g. not found). A refused token
   * becomes "sign in again"; slow-down and server trouble are waited out a few times.
   */
  async function call(method: string, params: Record<string, string | number>, what: string, okCodes: number[] = [], body?: FormData): Promise<Reply | null> {
    const url = new URL(`https://${session.hostname}/${method}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    url.searchParams.set('access_token', session.token)
    for (let attempt = 0; ; attempt++) {
      const res = await fetchFn(url.toString(), body ? { ...base, method: 'POST', body } : { ...base, method: 'GET' })
      const data = res.ok ? ((await res.json().catch(() => null)) as Reply | null) : null
      const code = data && typeof data.result === 'number' ? data.result : res.ok ? 5000 : res.status === 429 ? 4000 : 5000 + res.status
      if (code === 0) return data
      if (SIGNED_OUT.has(code)) throw signedOutError(NAME)
      if (okCodes.includes(code)) return null
      if (retryable(code) && attempt < retries) {
        await sleep(1000 * 2 ** attempt)
        continue
      }
      throw new PCloudError(code, typeof data?.error === 'string' ? data.error : res.ok ? '' : `HTTP ${res.status}`, what)
    }
  }

  async function listFolder(path: string): Promise<Meta[]> {
    const r = await call('listfolder', { path }, 'list the folder', NOT_FOUND)
    return ((r?.metadata as Meta | undefined)?.contents ?? [])
  }

  /** Creates the folder and its parents ("/a/b" → "/a", then "/a/b"). */
  async function makeFolders(dir: string) {
    let at = ''
    for (const part of dir.split('/').filter(Boolean)) {
      at += `/${part}`
      await call('createfolderifnotexists', { path: at }, `create the folder ${at}`)
    }
  }

  /** Uploads one file; creates missing folders once. `keep`: never overwrite (pCloud renames the new copy instead). */
  async function upload(path: string, data: Blob, keep: boolean): Promise<Meta> {
    const target = full(path)
    const dir = target.slice(0, target.lastIndexOf('/')) || '/'
    const name = target.slice(target.lastIndexOf('/') + 1)
    const params = { path: dir, nopartial: 1, ...(keep ? { renameifexists: 1 } : {}) }
    const form = () => {
      const f = new FormData()
      f.append('file', data, name)
      return f
    }
    let r = await call('uploadfile', params, `save ${path}`, [2005], form())
    if (!r) {
      await makeFolders(dir)
      r = await call('uploadfile', params, `save ${path}`, [], form())
    }
    const m = (r!.metadata as Meta[] | undefined)?.[0]
    if (!m) throw new PCloudError(5000, 'no file in the reply', `save ${path}`)
    return m
  }

  async function download(path: string): Promise<Response | null> {
    const link = await call('getfilelink', { path: full(path) }, `read ${path}`, NOT_FOUND)
    if (!link) return null
    const hosts = link.hosts as string[] | undefined
    if (!hosts?.length || typeof link.path !== 'string') throw new PCloudError(5000, 'no download link', `read ${path}`)
    const res = await fetchFn(`https://${hosts[0]}${link.path}`, base)
    if (!res.ok) throw new PCloudError(5000 + res.status, `HTTP ${res.status}`, `read ${path}`)
    return res
  }

  async function hasBlob(path: string): Promise<{ size: number } | null> {
    const r = await call('stat', { path: full(path) }, `check ${path}`, NOT_FOUND)
    const m = r?.metadata as Meta | undefined
    return m && !m.isfolder ? { size: m.size ?? 0 } : null
  }

  // pCloud's own event log: `diff` with last=0 only returns where the log is now. Any doubt means "changed".
  const changes: ChangeCheck = {
    async bookmark() {
      try {
        const r = await call('diff', { last: 0 }, 'check for changes')
        return r && (typeof r.diffid === 'number' || typeof r.diffid === 'string') ? String(r.diffid) : null
      } catch {
        return null
      }
    },
    async changedSince(bookmark) {
      try {
        const r = await call('diff', { diffid: bookmark, limit: 1 }, 'check for changes')
        return !r || !Array.isArray(r.entries) || r.entries.length > 0
      } catch {
        return true
      }
    },
  }

  return {
    changes,
    // Lists the root, then only the year folders and .meta, one level each: image folders are never walked.
    async list() {
      const out: StoredFile[] = []
      for (const f of await listFolder(rootPath)) {
        if (!f.isfolder || !(/^\d{4}$/.test(f.name) || f.name === '.meta')) continue
        for (const m of await listFolder(full(f.name))) {
          const path = `${f.name}/${m.name}`
          if (!m.isfolder && isDiaryFile(path)) out.push({ path, rev: revOf(m) })
        }
      }
      return out
    },
    async read(path) {
      const res = await download(path)
      return res ? res.text() : null
    },
    async write(path, text) {
      return revOf(await upload(path, new Blob([new TextEncoder().encode(text)]), false))
    },
    async remove(path) {
      await call('deletefile', { path: full(path) }, `delete ${path}`, NOT_FOUND)
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
      const m = await upload(path, blob, true)
      const wanted = path.slice(path.lastIndexOf('/') + 1)
      if (m.name === wanted) return
      // Another device wrote it in the meantime and pCloud saved ours under a new name: remove that copy, then the
      // same check as above.
      if (m.fileid !== undefined) await call('deletefile', { fileid: m.fileid }, `delete the extra copy of ${path}`, NOT_FOUND)
      const now = await hasBlob(path)
      if (now?.size === blob.size) return
      throw new BlobCollisionError(path, now?.size ?? 0, blob.size)
    },
    async removeBlob(path) {
      if (!isImagePath(path)) throw new Error(`Not an image path: ${path}`)
      await call('deletefile', { path: full(path) }, `delete ${path}`, NOT_FOUND)
    },
    // Deletes the app's folders (year folders, .meta, .thumbs) with their contents. Anything else stays, including the
    // development folder when this is the real journal.
    async removeAll() {
      for (const f of await listFolder(rootPath)) {
        if (f.isfolder && isAppFolder(f.name)) await call('deletefolderrecursive', { path: full(f.name) }, `delete ${f.name}`, NOT_FOUND)
      }
    },
  }
}
