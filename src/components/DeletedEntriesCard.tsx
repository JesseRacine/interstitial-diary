import { useState } from 'react'
import { db, restoreEntry } from '../lib/db'
import { entryImages, shortDayLabel, timeLabel } from '../lib/entry'
import { useLive } from '../lib/hooks'
import { restorable } from '../lib/purge'
import { purgeDeleted, useStorage } from '../storage/manager'

const PHRASE = 'DELETE FOREVER'

/**
 * Entries you deleted are only hidden: they stay here so you can restore them. "Delete permanently" erases the text and
 * photos of one (or all) of them for good, on this device and, at their next sync, on your other devices.
 */
export function DeletedEntriesCard() {
  const s = useStorage()
  const deleted = useLive(async () => restorable(await db.entries.filter((e) => !!e.deleted).toArray()), [], [])
  const [confirming, setConfirming] = useState<string | 'all' | null>(null) // an entry id, or all of them
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const storage = s.backendId ? s.label ?? 'your storage' : null
  const blocked = !!s.backendId && s.status === 'needs-permission'

  const close = () => { setConfirming(null); setTyped('') }

  const erase = async (ids: string[]) => {
    setBusy(true)
    setMessage(null)
    try {
      const n = await purgeDeleted(ids)
      close()
      setMessage(n === 1 ? 'Erased 1 entry for good.' : `Erased ${n} entries for good.`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const restore = async (id: string) => {
    setMessage(null)
    await restoreEntry(id)
    setMessage('Restored: it is back in your journal.')
  }

  const warning = (
    <>
      <strong>This can’t be undone.</strong> The text and photos are erased{storage ? <> here and, at their next sync, on your other devices</> : ' from this device'}.
      {s.backendId === 'dropbox' ? ' Dropbox may keep older versions of its files for about 30 days (dropbox.com > Deleted files).' : ''}
      {storage ? ' Open the app once on your other devices first, so they have this version.' : ''}
    </>
  )

  return (
    <div className="card">
      <h3>Deleted entries</h3>
      <p className="muted">
        Deleting an entry only hides it; it waits here so you can restore it. Erase it here to remove its text and photos for good.
      </p>
      {deleted.length === 0 ? (
        <p className="muted">No deleted entries.</p>
      ) : (
        <ul className="deleted-list">
          {deleted.map((e) => (
            <li key={e.id}>
              <div className="deleted-head">
                <span className="muted">{shortDayLabel(e.day)} {timeLabel(e.createdAt)}{entryImages(e).length ? ` · ${entryImages(e).length} photo${entryImages(e).length > 1 ? 's' : ''}` : ''}</span>
              </div>
              <div className="deleted-text">{e.text}</div>
              {confirming === e.id ? (
                <div className="notice warn" role="group" aria-label="Confirm delete permanently">
                  <p>{warning}</p>
                  <div className="row">
                    <button type="button" className="primary danger" onClick={() => void erase([e.id])} disabled={busy}>
                      {busy ? 'Erasing…' : 'Erase this entry'}
                    </button>
                    <button type="button" onClick={close} disabled={busy}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="row">
                  <button type="button" onClick={() => void restore(e.id)} disabled={busy}>Restore</button>
                  <button type="button" className="ghost danger" onClick={() => { setConfirming(e.id); setTyped(''); setMessage(null) }} disabled={busy || blocked}>
                    Delete permanently…
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {deleted.length > 1 && confirming !== 'all' && (
        <button type="button" className="ghost danger" onClick={() => { setConfirming('all'); setTyped(''); setMessage(null) }} disabled={busy || blocked}>
          Delete all permanently…
        </button>
      )}
      {confirming === 'all' && (
        <div className="notice warn" role="group" aria-label="Confirm delete all permanently">
          <p>{warning} This erases all {deleted.length} deleted entries.</p>
          <label>
            Type <strong>{PHRASE}</strong> to confirm:{' '}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} autoComplete="off" spellCheck={false} />
          </label>
          <div className="row">
            <button type="button" className="primary danger" onClick={() => void erase(deleted.map((e) => e.id))} disabled={busy || typed.trim().toUpperCase() !== PHRASE}>
              {busy ? 'Erasing…' : 'Erase all'}
            </button>
            <button type="button" onClick={close} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {blocked && <p className="muted">Allow access to {storage} first, so the erasure can reach it too.</p>}
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  )
}
