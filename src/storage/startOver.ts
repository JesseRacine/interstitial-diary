import type { FileStore } from './types'

/*
 * "Start over": erase the whole journal, on this device and in the storage, and make the other devices erase their
 * copy too (otherwise their next sync would upload it all again).
 *
 * The device that starts over empties the storage (FileStore.removeAll) and then writes a marker file with a new id.
 * Every device remembers, per storage module, the marker id it has already acted on (`resetKey`). On each sync:
 * - a marker this device hasn't seen, while it had seen an older one or none ("none") → this device clears its own
 *   copy first, then syncs (so it gets only what was written after the start-over);
 * - nothing remembered yet (a device that just connected, or that ran an older app version until now) → it only
 *   remembers the current marker. Connecting a device keeps its entries and uploads them, as always.
 * The marker is not a diary file (list() never returns it), so the sync engine ignores it.
 */

export const RESET_PATH = '.meta/reset.json'

export interface ResetMarker {
  id: string
  at: number // when the journal was started over (ms, the starting device's clock)
}

/** Meta key: the marker id this device has acted on for this storage module ("none" = there was no marker). */
export const resetKey = (backendId: string) => `reset:${backendId}`
export const NO_MARKER = 'none'

export async function readMarker(store: FileStore): Promise<ResetMarker | null> {
  const text = await store.read(RESET_PATH)
  if (!text) return null
  try {
    const m = JSON.parse(text) as Partial<ResetMarker>
    return typeof m.id === 'string' && m.id && typeof m.at === 'number' ? { id: m.id, at: m.at } : null
  } catch {
    return null // not ours or damaged: ignore it rather than erase anything
  }
}

export type ResetAction = 'none' | 'remember' | 'clear'

/** What a sync should do about the marker, given what this device remembers (undefined = nothing yet). */
export function resetAction(seen: string | undefined, marker: ResetMarker | null): ResetAction {
  if (seen === undefined) return 'remember'
  if (!marker) return 'none' // no marker (or it was removed by hand): nothing to act on
  return marker.id === seen ? 'none' : 'clear'
}

/** The value to remember after acting. */
export const seenValue = (marker: ResetMarker | null) => marker?.id ?? NO_MARKER

/**
 * Empty the storage and leave a new marker. Throws (changing nothing) if the module can't empty its storage. The marker
 * is written last, so a failure part-way leaves no marker and other devices keep their copies.
 */
export async function eraseStorage(store: FileStore, id: string, now = Date.now()): Promise<ResetMarker> {
  if (!store.removeAll) throw new Error('This storage can’t be emptied by the app. Delete its files yourself, then try again.')
  await store.removeAll()
  const marker: ResetMarker = { id, at: now }
  await store.write(RESET_PATH, JSON.stringify(marker))
  return marker
}

export const newResetId = () => `${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(2)).join('')}`
