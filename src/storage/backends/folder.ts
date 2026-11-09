import type { StorageBackend } from '../types'
import { directoryStore } from './fs-store'

/** Markdown files in a real folder the user picks (File System Access API: Chrome/Edge on desktop). */
export const folderBackend: StorageBackend<FileSystemDirectoryHandle> = {
  id: 'folder',
  name: 'Folder on this computer',
  description:
    'Saves one Markdown file per day into a folder you choose. Pick a folder inside pCloud Drive, OneDrive or Syncthing and that app will sync it for you.',

  unsupportedReason() {
    return typeof window !== 'undefined' && window.showDirectoryPicker
      ? null
      : 'Needs Chrome or Edge on a computer (not available on Android or Firefox).'
  },

  async setup() {
    const handle = await window.showDirectoryPicker!({ id: 'interstitial-diary', mode: 'readwrite' })
    return { config: handle, store: directoryStore(handle), label: `Folder “${handle.name}”` }
  },

  async open(handle, interactive) {
    if (!handle || typeof handle.queryPermission !== 'function') return { ok: false, reason: 'unavailable', message: 'Saved folder not found.' }
    let perm = await handle.queryPermission({ mode: 'readwrite' })
    if (perm !== 'granted' && interactive) perm = await handle.requestPermission({ mode: 'readwrite' })
    if (perm !== 'granted') return { ok: false, reason: 'needs-permission' }
    return { ok: true, store: directoryStore(handle), label: `Folder “${handle.name}”` }
  },
}
