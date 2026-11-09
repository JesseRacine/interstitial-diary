import { useEffect, useState } from 'react'
import { BACKENDS, PLANNED_BACKENDS } from '../storage/backends'
import { connect, disconnect, reconnect, type StorageState, syncNow, useStorage } from '../storage/manager'

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
    case 'ok': return s.pending ? `${s.pending} change${s.pending === 1 ? '' : 's'} waiting` : `Saved ${ago(s.lastSync)}`
    case 'needs-permission': return 'Access needed'
    case 'error': return 'Problem saving'
    default: return 'Not saved to files'
  }
}

/** Compact indicator for the header. */
export function StorageBadge({ onOpenSettings }: { onOpenSettings: () => void }) {
  const s = useStorage()
  useTick(30_000)
  if (s.status === 'off') return null
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
  const [choosing, setChoosing] = useState(false)
  useTick(30_000)
  const showChoices = s.status === 'off' || choosing

  return (
    <div className="card">
      <h3>Where entries are saved</h3>
      <p className="muted">
        Entries are always kept in this browser for fast search. Choose a storage below to also save them as Markdown files.
      </p>

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
