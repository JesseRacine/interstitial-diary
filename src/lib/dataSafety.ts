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

/** `meta` keys for the backup reminder. */
export const META_LAST_BACKUP = 'lastBackupAt' // when an export last finished (ms)
export const META_REMINDERS = 'backupReminders' // false = the user turned the reminder off
export const META_SNOOZED_UNTIL = 'backupSnoozedUntil' // "Later" was clicked: no reminder before this (ms)

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

/**
 * Whether the header should warn: no storage is chosen and there is something to lose. `restored` is false for the
 * first moments after startup, while the saved storage is still being read (it would flash a false warning).
 */
export function showHeaderWarning(restored: boolean, storageOff: boolean, entries: number, photos: number): boolean {
  return restored && storageOff && (entries > 0 || photos > 0)
}

// ---- Persistent storage ("will the browser delete our data when the device runs low on space?") ----

export type Persistence = 'granted' | 'not-granted' | 'unsupported'

export function persistenceInfo(p: Persistence): { ok: boolean; title: string; body: string } {
  switch (p) {
    case 'granted':
      return {
        ok: true,
        title: 'Protected from automatic cleanup',
        body: 'The browser has promised not to delete this site’s data when the device runs low on space. Clearing the site’s data by hand would still delete it.',
      }
    case 'not-granted':
      return {
        ok: false,
        title: 'Not protected from automatic cleanup',
        body: 'The browser may delete this site’s data if the device runs low on space. Installing the app and using it regularly usually gets this granted; a storage outside the browser, or Export, keeps a copy either way.',
      }
    default:
      return {
        ok: false,
        title: 'Can’t tell if the browser may delete this data',
        body: 'This browser doesn’t say whether it may delete this site’s data. A storage outside the browser, or Export, keeps a copy.',
      }
  }
}

// ---- Backup reminder ----

const DAY = 86_400_000
export const FIRST_BACKUP_AFTER_DAYS = 3 // no backup yet: remind once the oldest entry is this old
export const BACKUP_EVERY_DAYS = 14 // after a backup: remind when it is this old
export const SNOOZE_DAYS = 7 // "Later"

export interface ReminderInput {
  mode: BrowserOnly | null // null = a storage outside the browser holds a copy, so no reminder
  enabled: boolean
  entryCount: number
  oldestEntryAt: number | null
  lastBackupAt: number | null
  snoozedUntil: number | null
  now: number
}

/** Remind only people whose data lives in the browser alone, and only now and then. */
export function backupReminderDue(i: ReminderInput): boolean {
  if (!i.mode || !i.enabled || i.entryCount === 0 || i.oldestEntryAt === null) return false
  if (i.snoozedUntil !== null && i.now < i.snoozedUntil) return false
  if (i.lastBackupAt === null) return i.now - i.oldestEntryAt >= FIRST_BACKUP_AFTER_DAYS * DAY
  return i.now - i.lastBackupAt >= BACKUP_EVERY_DAYS * DAY
}

export const snoozeUntil = (now: number) => now + SNOOZE_DAYS * DAY

export function daysAgo(ts: number, now: number): string {
  const d = Math.floor((now - ts) / DAY)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

export function backupReminderText(lastBackupAt: number | null, now: number, entryCount: number): string {
  const what = `${entryCount} ${plural(entryCount, 'entry', 'entries')}`
  return lastBackupAt === null
    ? `Your ${what} ${entryCount === 1 ? 'exists' : 'exist'} only in this browser and you haven’t made a backup yet.`
    : `Your last backup was ${daysAgo(lastBackupAt, now)}, and your ${what} ${entryCount === 1 ? 'is' : 'are'} only in this browser.`
}
