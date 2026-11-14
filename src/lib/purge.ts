import { type Entry, withDerived } from './entry'

/*
 * "Delete permanently": erase a deleted entry's text and photo references for good.
 *
 * The row is scrubbed, not removed: it keeps its id, times and `deleted: 1` (so the tombstone in `.meta/tombstones.json`
 * keeps blocking a stale device or a stale day file from bringing the entry back), but its text and images are gone and
 * it carries `purged: 1`. The ids of purged entries are listed in `.meta/purged.json` so that every other device scrubs
 * its copy too when it next syncs (a tombstone alone leaves a deleted entry's text on the device that holds it).
 */

/** A deleted entry nobody can read any more. `updatedAt` stays as it is, so the tombstone does not change. */
export function scrubEntry(e: Entry): Entry {
  return withDerived({ ...e, text: '', deleted: 1, purged: 1, images: undefined, prevDay: undefined })
}

/** Deleted entries that can still be read or restored (what the "Deleted entries" list shows), newest first. */
export const restorable = (entries: readonly Entry[]): Entry[] =>
  entries.filter((e) => e.deleted && !e.purged && e.text !== '').sort((a, b) => b.createdAt - a.createdAt)

/** The ids to list in purged.json: the ones already listed there plus this device's purged entries; sorted, no repeats. */
export const purgedIds = (entries: readonly Entry[], remote: readonly string[]): string[] =>
  [...new Set([...remote, ...entries.filter((e) => e.purged).map((e) => e.id)])].sort()

/** Parse purged.json: a JSON array of id strings; anything else (damaged, not ours) counts as an empty list. */
export function parsePurged(text: string | null): string[] {
  if (!text) return []
  try {
    const v: unknown = JSON.parse(text)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
