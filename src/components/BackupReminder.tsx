import { useEffect, useState } from 'react'
import { getMeta, setMeta } from '../lib/db'
import {
  META_LAST_BACKUP, META_REMINDERS, META_SNOOZED_UNTIL, backupReminderDue, backupReminderText, snoozeUntil,
} from '../lib/dataSafety'
import type { Entry } from '../lib/entry'
import { useLive } from '../lib/hooks'
import { useBrowserOnlyMode } from './useBrowserOnlyMode'

interface ReminderMeta { enabled: boolean; lastBackupAt: number | null; snoozedUntil: number | null }

/**
 * A small notice above the journal for people whose entries exist only in this browser: "you haven't backed up for a
 * while". It reappears at most every few days ("Later" = 7 days) and can be turned off; Settings > Data safety has the switch.
 * Not shown to anyone with a storage outside the browser (the folder module), where files are the backup.
 */
export function BackupReminder({ entries, onBackUp }: { entries: Entry[]; onBackUp: () => void }) {
  const mode = useBrowserOnlyMode()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 60_000)
    return () => clearInterval(t)
  }, [])
  const meta = useLive<ReminderMeta | null>(async () => ({
    enabled: await getMeta(META_REMINDERS, true),
    lastBackupAt: await getMeta<number | null>(META_LAST_BACKUP, null),
    snoozedUntil: await getMeta<number | null>(META_SNOOZED_UNTIL, null),
  }), [], null)

  if (!meta) return null // meta not read yet: show nothing rather than flash a reminder
  const due = backupReminderDue({
    mode, ...meta, entryCount: entries.length, oldestEntryAt: entries[0]?.createdAt ?? null, now, // entries come oldest first
  })
  if (!due) return null

  return (
    <div className="notice warn backup-reminder" role="note">
      <span>{backupReminderText(meta.lastBackupAt, now, entries.length)}</span>
      <div className="row">
        <button type="button" className="primary" onClick={onBackUp}>Back up now</button>
        <button type="button" onClick={() => void setMeta(META_SNOOZED_UNTIL, snoozeUntil(Date.now()))}>Later</button>
        <button type="button" className="ghost" onClick={() => void setMeta(META_REMINDERS, false)}>Stop reminding me</button>
      </div>
    </div>
  )
}
