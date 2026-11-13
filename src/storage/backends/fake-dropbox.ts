/*
 * A small in-memory imitation of the parts of Dropbox's HTTP API that dropbox-store.ts uses, behind a `fetch`.
 * For tests only. It follows what Dropbox's docs say (409 + error_summary to match by prefix, delete_v2 using
 * `path_lookup/not_found`, case-insensitive paths, content_hash, has_more paging, 401 expired_access_token, 429 with
 * Retry-After) and is deliberately strict where the real API is: the root must be "" and other paths must start with "/".
 */

interface FakeFile {
  display: string // path as first written, e.g. "/2026/2026-11-08.md"
  bytes: Uint8Array
  hash: string
  rev: number
}

const textJson = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

/** Real error_summary values end in a random number of dots after a slash; callers must match by prefix. */
const err409 = (summary: string) => textJson(409, { error_summary: `${summary}/..`, error: {} })

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface FakeCall {
  endpoint: string
  arg: Record<string, unknown>
}

export function fakeDropbox(opts: { pageSize?: number } = {}) {
  const pageSize = opts.pageSize ?? 2
  const files = new Map<string, FakeFile>() // key: lower-cased path
  let validToken = 'token-1'
  let revCounter = 0
  const calls: FakeCall[] = []
  const rateLimited: number[] = [] // Retry-After seconds for the next requests
  /** Called before a request is handled; lets a test change things "in the meantime". */
  let beforeHandle: ((c: FakeCall) => Promise<void> | void) | null = null

  const meta = (f: FakeFile) => {
    const name = f.display.slice(f.display.lastIndexOf('/') + 1)
    return { '.tag': 'file', name, path_display: f.display, path_lower: f.display.toLowerCase(), size: f.bytes.length, rev: `0${f.rev}`, content_hash: f.hash }
  }

  /** Immediate children of a folder ("" is the root): files and the folders implied by deeper files. */
  function children(folder: string): Record<string, unknown>[] | null {
    const prefix = folder === '' ? '/' : `${folder.toLowerCase()}/`
    const out = new Map<string, Record<string, unknown>>()
    for (const [key, f] of files) {
      if (!key.startsWith(prefix)) continue
      const rest = f.display.slice(prefix.length)
      const slash = rest.indexOf('/')
      if (slash < 0) out.set(key, meta(f))
      else {
        const name = rest.slice(0, slash)
        const display = f.display.slice(0, prefix.length + slash)
        out.set(display.toLowerCase(), { '.tag': 'folder', name, path_display: display, path_lower: display.toLowerCase() })
      }
    }
    if (folder !== '' && out.size === 0) return null
    return [...out.values()]
  }

  function page(folder: string, offset: number) {
    const all = children(folder)!
    const entries = all.slice(offset, offset + pageSize)
    const next = offset + entries.length
    return textJson(200, { entries, cursor: JSON.stringify({ folder, offset: next }), has_more: next < all.length })
  }

  async function handle(endpoint: string, arg: Record<string, unknown>, body: Uint8Array): Promise<Response> {
    const path = typeof arg.path === 'string' ? arg.path : ''
    const valid = endpoint === 'files/list_folder' ? path === '' || path.startsWith('/') : path.startsWith('/') && path.length > 1
    if ('path' in arg && !valid) return textJson(400, { error_summary: 'malformed_path' })
    const key = path.toLowerCase()
    switch (endpoint) {
      case 'files/list_folder': {
        if (arg.recursive) return textJson(400, { error_summary: 'the fake does not do recursive listings' })
        return children(path) ? page(path, 0) : err409('path/not_found')
      }
      case 'files/list_folder/continue': {
        const c = JSON.parse(String(arg.cursor)) as { folder: string; offset: number }
        return page(c.folder, c.offset)
      }
      case 'files/get_metadata': {
        const f = files.get(key)
        if (f) return textJson(200, meta(f))
        return children(path) ? textJson(200, { '.tag': 'folder', name: path.slice(path.lastIndexOf('/') + 1) }) : err409('path/not_found')
      }
      case 'files/delete_v2': {
        const f = files.get(key)
        if (!f) return err409('path_lookup/not_found')
        files.delete(key)
        return textJson(200, { metadata: meta(f) })
      }
      case 'files/download': {
        const f = files.get(key)
        if (!f) return err409('path/not_found')
        return new Response(f.bytes.slice(), { status: 200, headers: { 'Dropbox-API-Result': JSON.stringify(meta(f)) } })
      }
      case 'files/upload': {
        if (arg.autorename !== false) return textJson(400, { error_summary: 'test expects autorename: false' })
        const existing = files.get(key)
        if (existing && arg.mode === 'add') return err409('path/conflict/file')
        if (arg.mode !== 'add' && arg.mode !== 'overwrite') return textJson(400, { error_summary: 'unexpected mode' })
        const f: FakeFile = { display: existing?.display ?? path, bytes: body, hash: await sha256Hex(body), rev: ++revCounter }
        files.set(key, f)
        return textJson(200, meta(f))
      }
      default:
        return textJson(400, { error_summary: `unknown endpoint ${endpoint}` })
    }
  }

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    const endpoint = url.pathname.replace(/^\/2\//, '')
    const headers = new Headers(init?.headers)
    const isContent = url.host === 'content.dropboxapi.com'
    if (url.host !== (isContent ? 'content.dropboxapi.com' : 'api.dropboxapi.com')) throw new TypeError(`unexpected host ${url.host}`)
    const rawArg = isContent ? headers.get('Dropbox-API-Arg') : String(init?.body ?? '{}')
    if (isContent && rawArg && /[^\x20-\x7e]/.test(rawArg)) return textJson(400, { error_summary: 'header not ASCII' })
    const arg = JSON.parse(rawArg ?? '{}') as Record<string, unknown>
    const call = { endpoint, arg }
    calls.push(call)
    const wait = rateLimited.shift()
    if (wait !== undefined) return textJson(429, { error_summary: 'too_many_requests/..' }, { 'Retry-After': String(wait) })
    if (headers.get('Authorization') !== `Bearer ${validToken}`) {
      return textJson(401, { error_summary: 'expired_access_token/..', error: { '.tag': 'expired_access_token' } })
    }
    if (beforeHandle) await beforeHandle(call)
    const body = isContent && init?.body ? new Uint8Array(await new Response(init.body).arrayBuffer()) : new Uint8Array()
    return handle(endpoint, arg, body)
  }) as typeof fetch

  return {
    fetch: fetchFn,
    files,
    calls,
    get token() { return validToken },
    /** The current access token stops working; the next one is different. */
    expireToken() { validToken = `token-${Number(validToken.split('-')[1]) + 1}` },
    /** The next n requests get 429 with this Retry-After. */
    rateLimit(n: number, retryAfter: number) { for (let i = 0; i < n; i++) rateLimited.push(retryAfter) },
    beforeHandle(fn: typeof beforeHandle) { beforeHandle = fn },
    /** Put a file directly into the fake (as if another app wrote it). */
    async put(path: string, data: string | Uint8Array) {
      const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
      files.set(path.toLowerCase(), { display: path, bytes, hash: await sha256Hex(bytes), rev: ++revCounter })
    },
    text(path: string) {
      const f = files.get(path.toLowerCase())
      return f ? new TextDecoder().decode(f.bytes) : null
    },
  }
}
