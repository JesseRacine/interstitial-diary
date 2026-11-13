import { useState } from 'react'
import type { Entry } from '../lib/entry'
import { startOver, useStorage } from '../storage/manager'
import { exportText } from '../lib/exportText'

const PHRASE = 'START OVER'

/** Erase the whole journal (this device, the storage, and, at their next sync, the other devices). */
export function StartOverCard({ entries }: { entries: Entry[] }) {
  const s = useStorage()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [backedUp, setBackedUp] = useState(false)

  const storage = s.backendId ? s.label ?? 'your storage' : null
  const blocked = s.backendId && s.status === 'needs-permission'
  const confirmed = typed.trim().toUpperCase() === PHRASE

  const close = () => { setOpen(false); setTyped(''); setBackedUp(false) }

  const run = async () => {
    setBusy(true)
    setMessage(null)
    try {
      await startOver()
      close()
      setMessage(storage
        ? `Done: the journal is empty here and in ${storage}. Your other devices clear their copy the next time they sync.`
        : 'Done: the journal on this device is empty.')
    } catch (e) {
      setMessage(`Nothing was erased here: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3>Start over</h3>
      <p className="muted">
        Erase every entry and photo{storage ? <> on this device and in <strong>{storage}</strong></> : ' on this device'}, to begin
        an empty journal. {storage ? 'Your other devices using it clear their copy the next time they sync.' : ''}
      </p>
      {!open ? (
        <button type="button" className="ghost danger" onClick={() => { setOpen(true); setMessage(null) }} disabled={!!blocked}>
          Start over…
        </button>
      ) : (
        <div className="notice warn" role="group" aria-label="Confirm start over">
          <p><strong>This can’t be undone in the app.</strong>{s.backendId === 'dropbox' ? ' Dropbox keeps deleted files for about 30 days (dropbox.com > Deleted files).' : ''}</p>
          <p>
            <button type="button" onClick={() => { exportText(entries); setBackedUp(true) }} disabled={!entries.length || busy}>
              Download a backup first (.zip)
            </button>{' '}
            <span className="muted">{backedUp ? 'Downloaded. ' : ''}Text only; for photos use “Export with photos” above.</span>
          </p>
          {storage && (
            <p className="muted">
              Open the app once on your other devices before this (so they have this version); a device still running an
              older version would upload its old copy again.
            </p>
          )}
          <label>
            Type <strong>{PHRASE}</strong> to confirm:{' '}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} disabled={busy} autoComplete="off" spellCheck={false} />
          </label>
          <div className="row">
            <button type="button" className="primary danger" onClick={() => void run()} disabled={!confirmed || busy}>
              {busy ? 'Erasing…' : 'Erase everything'}
            </button>
            <button type="button" onClick={close} disabled={busy}>Cancel</button>
          </div>
        </div>
      )}
      {blocked && <p className="muted">Allow access to {storage} first, so it can be emptied too.</p>}
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  )
}
