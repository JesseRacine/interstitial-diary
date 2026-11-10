import { useEffect, useState, useSyncExternalStore } from 'react'
import { db } from '../lib/db'
import { browserOnlyWarning, showHeaderWarning } from '../lib/dataSafety'
import { useLive } from '../lib/hooks'
import { BACKENDS, PLANNED_BACKENDS } from '../storage/backends'
import {
  connect, disconnect, imagesPending, missingImages, reconnect, type StorageState, syncNow, useStorage,
} from '../storage/manager'
import { useBrowserOnlyMode } from './useBrowserOnlyMode'

export function ago(ts: number | null): string {
  if (!ts) return 'never'
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s} s ago`
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function useTick(ms: number) {
  const [, setN] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(t)
  }, [ms])
}

function statusText(s: StorageState): string {
  switch (s.status) {
    case 'syncing': return 'Saving…'
    case 'ok': {
      const text = s.pending ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : `Saved ${ago(s.lastSync)}`
      const photos = imagesPending(s)
      return photos ? `${text} · ${photos} photo${photos === 1 ? '' : 's'} waiting` : text
    }
    case 'needs-permission': return 'Access needed'
    case 'error': return 'Problem saving'
    default: return 'Not saved to files'
  }
}

/** Photos this device holds (live, so the warning appears with the first photo). */
const usePhotoCount = () => useLive(() => db.blobs.count(), [], 0)
/** Entries (including deleted ones' tombstones, which is fine for "is there anything here"). */
const useEntryCount = () => useLive(() => db.entries.count(), [], 0)

/**
 * Compact indicator for the header. With no storage chosen it warns "Only in this browser" as soon as there is an
 * entry or a photo (the longer explanation is in Settings).
 */
export function StorageBadge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useStorage()
  const photos = usePhotoCount()
  const entries = useEntryCount()
  useTick(30_000)
  if (s.status === 'off') {
    if (!showHeaderWarning(s.restored, true, entries, photos)) return null
    const w = browserOnlyWarning('none', photos)
    return <button type="button" className="badge warn" onClick={onOpenSettings} title={w.body}>⚠ {w.short}</button>
  }
  if (s.status === 'needs-permission') {
    return <button type="button" className="badge warn" onClick={() => void reconnect()} title={`Allow access to ${s.label ?? 'storage'} again`}>⚠ Reconnect folder</button>
  }
  return (
    <button type="button" className={`badge ${s.status}`} onClick={onOpenSettings} title={s.message ?? s.label ?? ''}>
      <span className="dot" /> {statusText(s)}
    </button>
  )
}

export function StorageCard() {
  const s = useStorage()
  const missing = useSyncExternalStore(missingImages.subscribe, () => missingImages.size)
  const [choosing, setChoosing] = useState(false)
  const photos = usePhotoCount()
  useTick(30_000)
  const showChoices = s.status === 'off' || choosing
  const mode = useBrowserOnlyMode()
  const warning = mode ? browserOnlyWarning(mode, photos) : null

  return (
    <div className="card">
      <h3>Where entries are saved</h3>
      <p className="muted">
        Entries are always kept in this browser for fast search. A storage also saves them (and their photos) as files you own.
      </p>
      {warning && (
        <div className="notice warn" role="note">
          <strong>{warning.title}.</strong> {warning.body}
        </div>
      )}

      {s.status !== 'off' && (
        <div className="storage-current">
          <div>
            <strong>{s.label}</strong>
            <div className={`muted${s.status === 'error' ? ' error' : ''}`}>
              {statusText(s)}
              {s.status === 'error' && s.message ? `: ${s.message}` : ''}
              {s.lastReport && s.status === 'ok' && !s.pending
                ? ` · last run read ${s.lastReport.read}, wrote ${s.lastReport.written} file${s.lastReport.written === 1 ? '' : 's'}`
                : ''}
            </div>
            {s.imageError && <div className="muted error">Photos: {s.imageError} (will retry)</div>}
            {missing > 0 && (
              <div className="muted">
                {missing} photo{missing === 1 ? '' : 's'} from another device {missing === 1 ? "hasn't" : "haven't"} arrived
                yet ({missing === 1 ? 'it appears' : 'they appear'} once that device has synced)
              </div>
            )}
          </div>
          <div className="row">
            {s.status === 'needs-permission' ? (
              <button type="button" className="primary" onClick={() => void reconnect()}>Allow access</button>
            ) : (
              <button type="button" onClick={() => void syncNow()} disabled={s.status === 'syncing'}>Save now</button>
            )}
            <button type="button" onClick={() => setChoosing(!choosing)}>{choosing ? 'Cancel' : 'Change'}</button>
            <button type="button" className="ghost danger" onClick={() => { if (confirm('Stop saving to files? Your entries stay in this browser, and existing files are left as they are.')) void disconnect() }}>Stop</button>
          </div>
        </div>
      )}

      {showChoices && (
        <ul className="backends">
          {BACKENDS.map((b) => {
            const reason = b.unsupportedReason()
            const active = s.backendId === b.id
            return (
              <li key={b.id} className={reason ? 'disabled' : ''}>
                <div>
                  <strong>{b.name}</strong>
                  <p className="muted">{reason ?? b.description}</p>
                </div>
                <button type="button" className="primary" disabled={!!reason}
                  onClick={async () => { await connect(b.id); setChoosing(false) }}>
                  {active ? 'Choose again' : 'Use this'}
                </button>
              </li>
            )
          })}
          {PLANNED_BACKENDS.map((b) => (
            <li key={b.name} className="disabled">
              <div>
                <strong>{b.name}</strong>
                <p className="muted">{b.description}</p>
              </div>
              <span className="muted soon">Coming later</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
