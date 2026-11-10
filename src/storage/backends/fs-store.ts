import { BlobCollisionError, type FileStore, type StoredFile } from '../types'

/** Only these files belong to the diary; anything else in the folder is ignored. */
const isDiaryFile = (path: string) => /^\d{4}\/\d{4}-\d{2}-\d{2}\.md$/.test(path) || path === '.meta/tombstones.json'

const isNotFound = (e: unknown) => e instanceof DOMException && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError')

const revOf = (f: File) => `${f.lastModified}-${f.size}`

/** A FileStore on top of a directory handle: used by the local-folder and browser-files modules. */
export function directoryStore(root: FileSystemDirectoryHandle): FileStore {
  async function dirFor(path: string, create: boolean): Promise<[FileSystemDirectoryHandle, string]> {
    const parts = path.split('/')
    const name = parts.pop()!
    let dir = root
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create })
    return [dir, name]
  }

  async function walk(dir: FileSystemDirectoryHandle, prefix: string, out: StoredFile[]): Promise<void> {
    for await (const h of dir.values()) {
      const path = prefix + h.name
      if (h.kind === 'directory') {
        if (/^\d{4}$/.test(h.name) || h.name === '.meta') await walk(h as FileSystemDirectoryHandle, `${path}/`, out)
      } else if (isDiaryFile(path)) {
        out.push({ path, rev: revOf(await (h as FileSystemFileHandle).getFile()) })
      }
    }
  }

  async function getFile(path: string): Promise<File | null> {
    try {
      const [dir, name] = await dirFor(path, false)
      return await (await dir.getFileHandle(name)).getFile()
    } catch (e) {
      if (isNotFound(e)) return null
      throw e
    }
  }

  return {
    // list() deliberately doesn't walk image folders: it runs every sync and would stat thousands of photos.
    async list() {
      const out: StoredFile[] = []
      await walk(root, '', out)
      return out
    },
    async read(path) {
      try {
        const [dir, name] = await dirFor(path, false)
        return await (await (await dir.getFileHandle(name)).getFile()).text()
      } catch (e) {
        if (isNotFound(e)) return null
        throw e
      }
    },
    async write(path, content) {
      const [dir, name] = await dirFor(path, true)
      const fh = await dir.getFileHandle(name, { create: true })
      const w = await fh.createWritable()
      await w.write(content)
      await w.close()
      return revOf(await fh.getFile())
    },
    async remove(path) {
      try {
        const [dir, name] = await dirFor(path, false)
        await dir.removeEntry(name)
      } catch (e) {
        if (!isNotFound(e)) throw e
      }
    },
    async readBlob(path) {
      return getFile(path)
    },
    async hasBlob(path) {
      const f = await getFile(path)
      return f ? { size: f.size } : null
    },
    async removeBlob(path) {
      // Only ever the image folders; a typo can never reach a day file or the tombstones.
      if (!/^(\d{4}\/images|\.thumbs)\/[0-9a-f]{8,64}\.[a-z0-9]{1,5}$/.test(path)) throw new Error(`Not an image path: ${path}`)
      try {
        const [dir, name] = await dirFor(path, false)
        await dir.removeEntry(name)
      } catch (e) {
        if (!isNotFound(e)) throw e
      }
    },
    async writeBlob(path, blob) {
      const existing = await getFile(path)
      if (existing) {
        if (existing.size === blob.size) return
        throw new BlobCollisionError(path, existing.size, blob.size)
      }
      const [dir, name] = await dirFor(path, true)
      const fh = await dir.getFileHandle(name, { create: true })
      const w = await fh.createWritable() // writes to a temporary file; replaced only on close, so never half-written
      try {
        await w.write(blob)
        await w.close()
      } catch (e) {
        await w.abort().catch(() => {})
        throw e
      }
    },
  }
}
