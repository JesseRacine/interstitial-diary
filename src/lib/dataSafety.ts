/*
 * Wording for "your data only exists inside this browser". Browser data can be wiped (clearing site data, Android
 * "Clear storage", eviction when the device runs low, a changed address), so until a storage outside the browser holds
 * a copy, that is the one thing the user should know. Photos get their own wording: they are the biggest part of the
 * data, the most likely to run into the browser's space limit, and the hardest to get back.
 */

export type BrowserOnly =
  | 'none' // no storage chosen
  | 'inside-browser' // "Files inside this browser": its files live in the same browser data, so it is not a backup

/** null when a storage outside the browser's own data holds a copy. */
export function browserOnlyMode(backendId: string | null, insideBrowser: boolean): BrowserOnly | null {
  if (!backendId) return 'none'
  return insideBrowser ? 'inside-browser' : null
}

export interface BrowserOnlyWarning {
  short: string // for the header badge
  title: string
  body: string
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/** `photos` is how many photos this device holds (0 for none). */
export function browserOnlyWarning(mode: BrowserOnly, photos: number): BrowserOnlyWarning {
  const what = photos > 0 ? 'Entries and photos are' : 'Entries are'
  const loss = photos > 0
    ? `Clearing this site’s data, or the browser running low on space, would delete ${photos} ${plural(photos, 'photo', 'photos')} and all your entries. Photos are the hardest to get back.`
    : 'Clearing this site’s data would delete them.'
  const body = mode === 'none'
    ? `${loss} Choose a storage below to keep them as files${photos > 0 ? ', photos included' : ''}, or use Export to make a backup.`
    : `“Files inside this browser” lives in the same browser data, so it is not a backup. ${loss} Export makes a backup you can keep elsewhere.`
  return {
    short: photos > 0 ? 'Photos only in this browser' : 'Only in this browser',
    title: `${what} only in this browser`,
    body,
  }
}
