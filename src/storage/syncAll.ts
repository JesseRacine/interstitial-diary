import { type ImageLocal, type PullReport, type PushReport, pullImages, pushImages } from './attachments'
import { syncOnce } from './sync'
import { type FileStore, type LocalStore, type SyncReport, type SyncState, supportsBlobs } from './types'

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/**
 * One full sync run: push images → text sync → pull images. Each image pass has its own error handling.
 * - Originals are written before the day files that refer to them.
 * - Thumbnails are pulled after the text sync, so entries that just arrived get theirs in the same run.
 * - An image failure never blocks the text sync and never makes it fail; it is reported in `images`/`pulled` instead.
 * - A text sync failure still throws, exactly as syncOnce does (and the pull pass is skipped).
 */
export async function syncAll(
  local: LocalStore,
  images: ImageLocal,
  store: FileStore,
  prev: SyncState,
  confirmed: ReadonlySet<string>,
): Promise<{
  state: SyncState
  report: SyncReport
  images: PushReport | null
  pulled: PullReport | null
  confirmed: Set<string>
}> {
  let imageReport: PushReport | null = null
  let pulled: PullReport | null = null
  let nextConfirmed = new Set(confirmed)
  const blobs = supportsBlobs(store)
  if (blobs) {
    try {
      const r = await pushImages(images, store, nextConfirmed)
      imageReport = r.report
      nextConfirmed = r.confirmed
    } catch (e) {
      imageReport = { written: 0, pending: 0, errors: [message(e)] }
    }
  }
  const { state, report } = await syncOnce(local, store, prev)
  if (blobs) {
    try {
      const r = await pullImages(images, store, nextConfirmed)
      pulled = r.report
      nextConfirmed = r.confirmed
    } catch (e) {
      pulled = { fetched: 0, rebuilt: 0, missing: [], failed: 0, errors: [message(e)] }
    }
  }
  return { state, report, images: imageReport, pulled, confirmed: nextConfirmed }
}
