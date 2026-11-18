import type { StorageBackend } from '../types'
import { browserBackend } from './browser'
import { dropboxBackend } from './dropbox'
import { folderBackend } from './folder'
import { pcloudBackend } from './pcloud'

/**
 * All storage modules. To add one (pCloud, GitHub, WebDAV...), implement StorageBackend
 * in its own file and add it here; the sync engine and Settings screen pick it up automatically.
 */
export const BACKENDS: StorageBackend<never>[] = [
  folderBackend as StorageBackend<never>,
  browserBackend as StorageBackend<never>,
  dropboxBackend as StorageBackend<never>,
  pcloudBackend as StorageBackend<never>,
]

/** Shown in Settings as "coming later". */
export const PLANNED_BACKENDS = [
  { name: 'GitHub', description: 'Keep the Markdown files in a private GitHub repository.' },
]

export const backendById = (id: string) => BACKENDS.find((b) => b.id === id)
