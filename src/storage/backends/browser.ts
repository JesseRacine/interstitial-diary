import type { StorageBackend } from '../types'
import { directoryStore } from './fs-store'

async function root() {
  const top = await navigator.storage.getDirectory()
  return top.getDirectoryHandle('InterstitialDiary', { create: true })
}

/** Markdown files in the browser's private file system (OPFS). Works everywhere, including Android. */
export const browserBackend: StorageBackend<Record<string, never>> = {
  id: 'browser',
  name: 'Files inside this browser',
  description:
    'Keeps a Markdown copy of every day in the browser’s private storage. Works on Android too, but the files are only reachable through Export.',

  unsupportedReason() {
    return typeof navigator !== 'undefined' && navigator.storage && 'getDirectory' in navigator.storage
      ? null
      : 'This browser has no private file storage.'
  },

  async setup() {
    return { config: {}, store: directoryStore(await root()), label: 'Browser files' }
  },

  async open() {
    try {
      return { ok: true, store: directoryStore(await root()), label: 'Browser files' }
    } catch (e) {
      return { ok: false, reason: 'unavailable', message: String(e) }
    }
  },
}
