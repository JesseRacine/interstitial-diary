/*
 * A small in-memory imitation of the parts of pCloud's HTTP JSON API that pcloud-store.ts uses, behind a `fetch`.
 * For tests only. It follows pCloud's docs: errors as HTTP 200 with `result` ≠ 0 (2005 folder missing, 2009 file
 * missing, 2002 parent missing, 2094 bad token, 4000 slow down); uploads need the folder to exist, overwrite by default
 * and rename with `renameifexists`; `hash` is a content hash; `getfilelink` gives a host and path to download from.
 * Paths are case-sensitive and start with "/".
 */

interface FakeFile {
  bytes: Uint8Array
  hash: number
  fileid: number
}

export interface FakeCall {
  method: string
  params: Record<string, string>
}

const API_HOST = 'api.pcloud.com'
const DL_HOST = 'c1.pcloud.com'

const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })

/** FNV-1a: a stand-in content hash (same bytes, same number). */
function hashOf(bytes: Uint8Array): number {
  let h = 0x811c9dc5
  for (const b of bytes) h = Math.imul(h ^ b, 0x01000193) >>> 0
  return h
}

const parentOf = (p: string) => p.slice(0, p.lastIndexOf('/')) || '/'
const nameOf = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const join = (dir: string, name: string) => (dir === '/' ? `/${name}` : `${dir}/${name}`)

export function fakePCloud() {
  const files = new Map<string, FakeFile>()
  const folders = new Set<string>(['/'])
  const token = 'pc-token-1'
  const calls: FakeCall[] = []
  const changeLog: string[] = []
  let nextId = 1
  let slowDown = 0
  let beforeHandle: ((c: FakeCall) => Promise<void> | void) | null = null

  const fileMeta = (path: string, f: FakeFile) => ({ name: nameOf(path), isfolder: false, size: f.bytes.length, hash: f.hash, fileid: f.fileid })
  const folderMeta = (path: string) => ({ name: nameOf(path) || '/', isfolder: true })

  function addFolders(dir: string) {
    let at = ''
    for (const part of dir.split('/').filter(Boolean)) folders.add((at += `/${part}`))
  }

  function write(path: string, bytes: Uint8Array) {
    const f = { bytes, hash: hashOf(bytes), fileid: nextId++ }
    files.set(path, f)
    changeLog.push(path)
    return f
  }

  function del(path: string) {
    files.delete(path)
    changeLog.push(path)
  }

  async function api(method: string, p: Record<string, string>, body: FormData | null): Promise<Response> {
    const err = (result: number) => json({ result, error: `error ${result}` })
    switch (method) {
      case 'listfolder': {
        if (!folders.has(p.path)) return err(2005)
        const contents = [
          ...[...folders].filter((d) => d !== '/' && parentOf(d) === p.path).map(folderMeta),
          ...[...files].filter(([k]) => parentOf(k) === p.path).map(([k, f]) => fileMeta(k, f)),
        ]
        return json({ result: 0, metadata: { ...folderMeta(p.path), contents } })
      }
      case 'createfolderifnotexists':
        if (!folders.has(parentOf(p.path))) return err(2002)
        folders.add(p.path)
        return json({ result: 0, created: true, metadata: folderMeta(p.path) })
      case 'uploadfile': {
        if (!folders.has(p.path)) return err(2005)
        const file = body?.get('file') as File | null
        if (!file) return err(2001)
        let name = file.name
        if (p.renameifexists === '1') {
          const dot = name.lastIndexOf('.')
          for (let n = 2; files.has(join(p.path, name)); n++) name = `${file.name.slice(0, dot)} (${n})${file.name.slice(dot)}`
        }
        const path = join(p.path, name)
        return json({ result: 0, metadata: [fileMeta(path, write(path, new Uint8Array(await file.arrayBuffer())))] })
      }
      case 'getfilelink': {
        const f = files.get(p.path)
        return f ? json({ result: 0, hosts: [DL_HOST], path: `/dl/${f.fileid}/${encodeURIComponent(nameOf(p.path))}` }) : err(2009)
      }
      case 'stat': {
        const f = files.get(p.path)
        if (f) return json({ result: 0, metadata: fileMeta(p.path, f) })
        return folders.has(p.path) ? json({ result: 0, metadata: folderMeta(p.path) }) : err(2009)
      }
      case 'deletefile': {
        const path = p.fileid ? [...files].find(([, f]) => String(f.fileid) === p.fileid)?.[0] : p.path
        if (!path || !files.has(path)) return err(2009)
        del(path)
        return json({ result: 0 })
      }
      case 'deletefolderrecursive': {
        if (!folders.has(p.path) || p.path === '/') return err(2005)
        for (const k of [...files.keys()]) if (k.startsWith(`${p.path}/`)) del(k)
        for (const d of [...folders]) if (d === p.path || d.startsWith(`${p.path}/`)) folders.delete(d)
        return json({ result: 0 })
      }
      case 'diff': {
        if (p.last === '0') return json({ result: 0, diffid: changeLog.length, entries: [] })
        const from = Number(p.diffid)
        if (!Number.isInteger(from) || from > changeLog.length) return err(2000 + 1)
        return json({ result: 0, diffid: changeLog.length, entries: changeLog.slice(from, from + Number(p.limit ?? 100)).map((path) => ({ event: 'modifyfile', path })) })
      }
      default:
        return err(1001)
    }
  }

  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    if (url.host === DL_HOST) {
      const id = url.pathname.split('/')[2]
      const f = [...files.values()].find((x) => String(x.fileid) === id)
      return f ? new Response(new Blob([f.bytes as Uint8Array<ArrayBuffer>])) : new Response('gone', { status: 404 })
    }
    if (url.host !== API_HOST) throw new TypeError(`fake pCloud: unexpected host ${url.host}`)
    const params = Object.fromEntries(url.searchParams)
    const method = url.pathname.slice(1)
    const { access_token: sent, ...rest } = params
    const call = { method, params: rest }
    calls.push(call)
    if (beforeHandle) await beforeHandle(call)
    if (sent !== token) return json({ result: 2094, error: 'Invalid access_token provided.' })
    if (slowDown > 0) {
      slowDown--
      return json({ result: 4000, error: 'Too many requests.' })
    }
    return api(method, rest, init?.body instanceof FormData ? init.body : null)
  }) as typeof fetch

  return {
    token,
    hostname: API_HOST,
    files,
    folders,
    calls,
    fetch: fetchFn,
    /** Put a file as another device would (folders appear as needed). */
    put(path: string, data: string | Uint8Array) {
      addFolders(parentOf(path))
      write(path, typeof data === 'string' ? new TextEncoder().encode(data) : data)
    },
    text: (path: string) => (files.has(path) ? new TextDecoder().decode(files.get(path)!.bytes) : null),
    /** The next `n` API calls answer "slow down" (4000). */
    slowDownFor(n: number) { slowDown = n },
    beforeHandle(fn: typeof beforeHandle) { beforeHandle = fn },
  }
}
