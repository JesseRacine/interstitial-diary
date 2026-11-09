import { type ImageLocal, type PushReport, pushImages } from './attachments'
import { syncOnce } from './sync'
import { type FileStore, type LocalStore, type SyncReport, type SyncState, supportsBlobs } from './types'

/**
 * One full sync run: images first (own error handling), then the text sync.
 * - Originals are written before the day files that refer to them.
 * - An image failure never blocks the text sync and never makes it fail; it is reported in `images` instead.
 * - A text sync failure still throws, exactly as syncOnce does.
 */
export async function syncAll(
  local: LocalStore,
  images: ImageLocal,
  store: FileStore,
  prev: SyncState,
  confirmed: ReadonlySet<string>,
): Promise<{ state: SyncState; report: SyncReport; images: PushReport | null; confirmed: Set<string> }> {
  let imageReport: PushReport | null = null
  let nextConfirmed = new Set(confirmed)
  if (supportsBlobs(store)) {
    try {
      const r = await pushImages(images, store, confirmed)
      imageReport = r.report
      nextConfirmed = r.confirmed
    } catch (e) {
      imageReport = { written: 0, pending: 0, errors: [e instanceof Error ? e.message : String(e)] }
    }
  }
  const { state, report } = await syncOnce(local, store, prev)
  return { state, report, images: imageReport, confirmed: nextConfirmed }
}
