import { cleanReturnUrl, parseReturn, type PendingStore } from './backends/oauth'
import type { FileStore, StorageBackend } from './types'

export type ResumeResult =
  | { ok: true; backendId: string; config: unknown; store: FileStore; label: string; cleanUrl: string }
  | { ok: false; message: string; cleanUrl: string }

/**
 * At startup: if this page load is the return from a storage module's sign-in page, finish that module's setup.
 * Returns null for an ordinary page load (nothing to do). Otherwise the caller replaces the URL with `cleanUrl`, so a
 * reload never tries the same sign-in again, and either adopts the new storage or shows `message`.
 */
export async function resumeFromRedirect(
  href: string, pending: PendingStore, lookup: (id: string) => StorageBackend<unknown> | undefined,
): Promise<ResumeResult | null> {
  if (!parseReturn(href)) return null
  const cleanUrl = cleanReturnUrl(href)
  const started = await pending.get()
  const backend = started ? lookup(started.backendId) : undefined
  if (!backend?.resumeSetup) {
    await pending.clear()
    return {
      ok: false,
      cleanUrl,
      message: started ? `Unknown storage “${started.backendId}”.` : 'This sign-in was not started here, or it was already finished. Please try again.',
    }
  }
  try {
    const r = await backend.resumeSetup(href)
    return { ok: true, backendId: backend.id, ...r, cleanUrl }
  } catch (e) {
    return { ok: false, cleanUrl, message: e instanceof Error ? e.message : String(e) }
  }
}
