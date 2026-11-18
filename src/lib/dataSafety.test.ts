import { describe, expect, it } from 'vitest'
import {
  BACKUP_EVERY_DAYS, FIRST_BACKUP_AFTER_DAYS, SNOOZE_DAYS, type ReminderInput,
  backupReminderDue, backupReminderText, browserOnlyMode, browserOnlyWarning, daysAgo, persistenceInfo, showHeaderWarning, snoozeUntil,
} from './dataSafety'

const DAY = 86_400_000

// The wording itself is free to change; these check when warnings show and that they carry the right facts.

describe('the "only in this browser" warning', () => {
  it('applies with no storage or "Files inside this browser", not with a storage outside the browser', () => {
    expect(browserOnlyMode(null, false)).toBe('none')
    expect(browserOnlyMode('browser', true)).toBe('inside-browser')
    expect(browserOnlyMode('folder', false)).toBeNull()
  })

  it('mentions photos only when there are some, with their count; inside-browser storage is called not a backup', () => {
    expect(browserOnlyWarning('none', 0).body).not.toMatch(/photo/i)
    expect(browserOnlyWarning('none', 12).body).toContain('12 photos')
    expect(browserOnlyWarning('none', 1).body).not.toContain('1 photos')
    const inside = browserOnlyWarning('inside-browser', 3)
    expect(inside.body).toMatch(/not a backup/)
    expect(inside.body).not.toMatch(/Choose a storage/) // one is chosen already
  })

  it('shows in the header with no storage and any entry or photo, not for an empty journal or before startup has read the storage', () => {
    expect(showHeaderWarning(true, true, 1, 0)).toBe(true)
    expect(showHeaderWarning(true, true, 0, 1)).toBe(true)
    expect(showHeaderWarning(true, true, 0, 0)).toBe(false)
    expect(showHeaderWarning(true, false, 50, 9)).toBe(false)
    expect(showHeaderWarning(false, true, 50, 9)).toBe(false) // no false flash for folder users
  })
})

it('persistent storage counts as protected only when granted', () => {
  expect(persistenceInfo('granted').ok).toBe(true)
  expect(persistenceInfo('not-granted').ok).toBe(false)
  expect(persistenceInfo('unsupported').ok).toBe(false)
})

describe('backupReminderDue', () => {
  const now = 1_800_000_000_000
  const base: ReminderInput = {
    mode: 'none', enabled: true, entryCount: 10, oldestEntryAt: now - 30 * DAY, lastBackupAt: null, snoozedUntil: null, now,
  }
  const due = (o: Partial<ReminderInput> = {}) => backupReminderDue({ ...base, ...o })

  it('reminds someone with no backup whose oldest entry is old enough', () => expect(due()).toBe(true))
  it('waits a few days for a brand-new journal', () => {
    expect(due({ oldestEntryAt: now - (FIRST_BACKUP_AFTER_DAYS - 1) * DAY })).toBe(false)
    expect(due({ oldestEntryAt: now - FIRST_BACKUP_AFTER_DAYS * DAY })).toBe(true)
  })
  it('after a backup, waits the full interval', () => {
    expect(due({ lastBackupAt: now - (BACKUP_EVERY_DAYS - 1) * DAY })).toBe(false)
    expect(due({ lastBackupAt: now - BACKUP_EVERY_DAYS * DAY })).toBe(true)
  })
  it('a recent backup silences it even for an old journal', () => expect(due({ lastBackupAt: now - DAY })).toBe(false))
  it('never reminds when a storage outside the browser holds a copy', () => expect(due({ mode: null })).toBe(false))
  it('also reminds when the only storage is "Files inside this browser"', () => expect(due({ mode: 'inside-browser' })).toBe(true))
  it('never reminds when turned off or when there are no entries', () => {
    expect(due({ enabled: false })).toBe(false)
    expect(due({ entryCount: 0, oldestEntryAt: null })).toBe(false)
  })
  it('"Later" snoozes it until the time passes', () => {
    expect(due({ snoozedUntil: snoozeUntil(now) })).toBe(false)
    expect(due({ snoozedUntil: now + 1 })).toBe(false)
    expect(due({ snoozedUntil: now })).toBe(true)
    expect(snoozeUntil(now)).toBe(now + SNOOZE_DAYS * DAY)
  })
  it('a backup time in the future (clock changed) does not trigger a reminder', () => expect(due({ lastBackupAt: now + DAY })).toBe(false))

  it('the reminder gives the entry count (singular for one) and how long ago the last backup was', () => {
    expect(daysAgo(now, now)).toBe('today')
    expect(daysAgo(now - DAY, now)).toBe('yesterday')
    expect(backupReminderText(null, now, 12)).toContain('12 entries')
    expect(backupReminderText(null, now, 1)).toContain('1 entry ')
    expect(backupReminderText(now - 20 * DAY, now, 12)).toContain('20 days ago')
  })
})
