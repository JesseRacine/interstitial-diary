import { useEffect, useState } from 'react'
import { getMeta, setMeta } from '../lib/db'
import {
  META_LAST_BACKUP, META_REMINDERS, META_SNOOZED_UNTIL, type Persistence, daysAgo, persistenceInfo,
} from '../lib/dataSafety'
import { useLive } from '../lib/hooks'

async function readPersistence(): Promise<Persistence> {
  const storage = typeof navigator === 'undefined' ? undefined : navigator.storage
  if (!storage?.persisted) return 'unsupported'
  try { return (await storage.persisted()) ? 'granted' : 'not-granted' } catch { return 'unsupported' }
}

/** Settings: is the browser allowed to delete our data, when was the last backup, and the backup-reminder switch. */
export function DataSafetyCard() {
  const [persistence, setPersistence] = useState<Persistence | null>(null)
  const [asked, setAsked] = useState(false)
  const [now] = useState(() => Date.now())
  const lastBackup = useLive(() => getMeta<number | null>(META_LAST_BACKUP, null), [], null)
  const reminders = useLive(() => getMeta(META_REMINDERS, true), [], true)

  useEffect(() => {
    let live = true
    void readPersistence().then((p) => { if (live) setPersistence(p) })
    return () => { live = false }
  }, [])

  const askAgain = async () => {
    try { await navigator.storage.persist() } catch { /* the check below reports the result */ }
    setPersistence(await readPersistence())
    setAsked(true)
  }

  const info = persistence ? persistenceInfo(persistence) : null

  return (
    <div className="card">
      <h3>Data safety</h3>

      <div className={`notice${info && !info.ok ? ' warn' : ''}`} role="note">
        {info ? (
          <>
            <strong>{info.title}.</strong> {info.body}
            {persistence === 'not-granted' && (
              <div className="row">
                <button type="button" onClick={() => void askAgain()}>Ask the browser again</button>
                {asked && <span className="muted">The browser said no for now. It decides by itself, based on how often you use the app.</span>}
              </div>
            )}
          </>
        ) : (
          <span className="muted">Checking…</span>
        )}
      </div>

      <p>
        <strong>Last backup (export):</strong>{' '}
        {lastBackup ? `${daysAgo(lastBackup, now)} (${new Date(lastBackup).toLocaleDateString()})` : 'never'}
      </p>

      <label className="check">
        <input type="checkbox" checked={reminders}
          onChange={(e) => {
            void setMeta(META_REMINDERS, e.target.checked)
            if (e.target.checked) void setMeta(META_SNOOZED_UNTIL, null)
          }} />
        Remind me to back up when my entries are only in this browser
      </label>
    </div>
  )
}
