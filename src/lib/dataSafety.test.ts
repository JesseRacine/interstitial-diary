import { describe, expect, it } from 'vitest'
import {
  BACKUP_EVERY_DAYS, FIRST_BACKUP_AFTER_DAYS, SNOOZE_DAYS, type ReminderInput,
  backupReminderDue, backupReminderText, browserOnlyMode, browserOnlyWarning, daysAgo, persistenceInfo, showHeaderWarning, snoozeUntil,
} from './dataSafety'

const DAY = 86_400_000

describe('browserOnlyMode', () => {
  it('no storage chosen: the data is only in this browser', () => expect(browserOnlyMode(null, false)).toBe('none'))
  it('"Files inside this browser" is not a backup either', () => expect(browserOnlyMode('browser', true)).toBe('inside-browser'))
  it('a storage outside the browser data is a copy, so no warning', () => expect(browserOnlyMode('folder', false)).toBeNull())
})

describe('browserOnlyWarning', () => {
  it('without photos it talks about entries only', () => {
    const w = browserOnlyWarning('none', 0)
    expect(w.title).toBe('Entries are only in this browser')
    expect(w.short).toBe('Only in this browser')
    expect(w.body).not.toMatch(/photo/i)
    expect(w.body).toMatch(/Choose a storage/)
  })

  it('with photos it says photos are only in this browser too, and how many', () => {
    const w = browserOnlyWarning('none', 12)
    expect(w.title).toBe('Entries and photos are only in this browser')
    expect(w.short).toBe('Photos only in this browser')
    expect(w.body).toContain('12 photos')
    expect(w.body).toMatch(/photos included/)
  })

  it('one photo is singular', () => {
    expect(browserOnlyWarning('none', 1).body).toContain('1 photo and')
    expect(browserOnlyWarning('none', 1).body).not.toContain('1 photos')
  })

  it('inside-browser storage says plainly that it is not a backup, with and without photos', () => {
    for (const photos of [0, 3]) {
      const w = browserOnlyWarning('inside-browser', photos)
      expect(w.body).toMatch(/not a backup/)
      expect(w.body).toMatch(/Export/)
      expect(w.body).not.toMatch(/Choose a storage/) // one is chosen already
    }
  })
})

describe('showHeaderWarning', () => {
  it('shows with no storage and any entry or photo', () => {
    expect(showHeaderWarning(true, true, 1, 0)).toBe(true)
    expect(showHeaderWarning(true, true, 0, 1)).toBe(true)
  })
  it('stays quiet for an empty journal, or when a storage exists', () => {
    expect(showHeaderWarning(true, true, 0, 0)).toBe(false)
    expect(showHeaderWarning(true, false, 50, 9)).toBe(false)
  })
  it('stays quiet until the saved storage has been read at startup (no false flash for folder users)', () => {
    expect(showHeaderWarning(false, true, 50, 9)).toBe(false)
  })
})

describe('persistenceInfo', () => {
  it('granted is ok and says protected', () => {
    const p = persistenceInfo('granted')
    expect(p.ok).toBe(true)
    expect(p.title).toMatch(/^Protected/)
  })
  it('not granted warns and points to installing, a storage, or Export', () => {
    const p = persistenceInfo('not-granted')
    expect(p.ok).toBe(false)
    expect(p.title).toMatch(/^Not protected/)
    expect(p.body).toMatch(/Installing/)
    expect(p.body).toMatch(/Export/)
  })
  it('unsupported is not ok and does not claim protection', () => {
    const p = persistenceInfo('unsupported')
    expect(p.ok).toBe(false)
    expect(p.title).not.toMatch(/^Protected/)
  })
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
})

describe('backup reminder wording', () => {
  const now = 1_800_000_000_000
  it('daysAgo', () => {
    expect(daysAgo(now, now)).toBe('today')
    expect(daysAgo(now - DAY, now)).toBe('yesterday')
    expect(daysAgo(now - 20 * DAY, now)).toBe('20 days ago')
  })
  it('never backed up', () => {
    expect(backupReminderText(null, now, 12)).toBe('Your 12 entries exist only in this browser and you haven’t made a backup yet.')
    expect(backupReminderText(null, now, 1)).toBe('Your 1 entry exists only in this browser and you haven’t made a backup yet.')
  })
  it('after an old backup', () => {
    expect(backupReminderText(now - 20 * DAY, now, 12)).toBe('Your last backup was 20 days ago, and your 12 entries are only in this browser.')
  })
})
