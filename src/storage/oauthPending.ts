import { db, getMeta, setMeta } from '../lib/db'
import type { PendingSignIn, PendingStore } from './backends/oauth'

const KEY = 'oauth:pending'

/**
 * The started-but-unfinished sign-in, in the IndexedDB meta table: shared by every tab and the installed app of this
 * origin, so the return from the sign-in page can be finished wherever Android or the browser opens it.
 */
export const metaPending: PendingStore = {
  get: () => getMeta<PendingSignIn | null>(KEY, null),
  set: (p) => setMeta(KEY, p),
  clear: async () => { await db.meta.delete(KEY) },
}
