import { useEffect, useState } from 'react'
import { getOriginalsLimit, photoUsage, setOriginalsLimit } from '../lib/db'
import { useLive } from '../lib/hooks'
import { formatBytes } from '../lib/images'
import { applyOriginalsLimit, useOriginalsLimitMode, useStorage } from '../storage/manager'
import { ORIGINALS_CACHE_BYTES, ORIGINALS_LIMIT_CHOICES, limitBytes } from '../storage/originals'

/** What the browser says this site uses, and how much it allows (an estimate; not every browser has it). */
function useBrowserEstimate(refreshWhen: unknown) {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null)
  useEffect(() => {
    let live = true
    const estimate = navigator.storage?.estimate
    if (!estimate) return
    navigator.storage.estimate().then(
      (e) => { if (live && e.usage !== undefined && e.quota) setEst({ usage: e.usage, quota: e.quota }) },
      () => { /* no estimate: the row just isn't shown */ },
    )
    return () => { live = false }
  }, [refreshWhen])
  return est
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Settings: how much space photos take on this device, and how much of it full-size photos may use. Only photos that
 * storage has its own copy of are ever removed to stay under the limit (see trimOriginals in storage/manager.ts).
 */
export function PhotoStorageCard() {
  const usage = useLive(photoUsage, [], null)
  const setting = useLive(getOriginalsLimit, [], ORIGINALS_CACHE_BYTES)
  const s = useStorage()
  const mode = useOriginalsLimitMode()
  const est = useBrowserEstimate(usage?.originalBytes)

  const change = async (bytes: number) => {
    await setOriginalsLimit(bytes)
    await applyOriginalsLimit() // lowering it frees space now, not at the next sync
  }

  const limit = limitBytes(setting)
  const over = usage && Number.isFinite(limit) ? usage.originalBytes - limit : 0

  return (
    <div className="card">
      <h3>Photos on this device</h3>
      {!usage ? (
        <p className="muted">Adding up the photos…</p>
      ) : usage.originals === 0 && usage.thumbs === 0 ? (
        <p className="muted">No photos are stored in this browser yet.</p>
      ) : (
        <table className="usage">
          <tbody>
            <tr>
              <td>Full-size photos</td>
              <td>{plural(usage.originals, 'photo', 'photos')} · <strong>{formatBytes(usage.originalBytes)}</strong></td>
            </tr>
            {usage.unsavedOriginals > 0 && (
              <tr className="muted">
                <td>…not in storage yet</td>
                <td>{usage.unsavedOriginals} · {formatBytes(usage.unsavedBytes)} (never removed automatically)</td>
              </tr>
            )}
            <tr>
              <td>Thumbnails</td>
              <td>{usage.thumbs} · {formatBytes(usage.thumbBytes)}</td>
            </tr>
            {est && (
              <tr>
                <td>All of this app’s data in the browser</td>
                <td>about {formatBytes(est.usage)} of the {formatBytes(est.quota)} the browser allows</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <p>
        <label>
          Keep at most{' '}
          <select value={setting} onChange={(e) => void change(Number(e.target.value))} aria-label="Limit for full-size photos on this device">
            {ORIGINALS_LIMIT_CHOICES.map((c) => <option key={c.bytes} value={c.bytes}>{c.label}</option>)}
          </select>
          {' '}of full-size photos on this device
        </label>
      </p>
      <p className="muted">
        {mode === 'applies' && (
          <>
            Over that, the photos you opened longest ago are taken off this device, but only ones {s.label ?? 'your storage'} already
            has its own copy of. They download again when you open them. Thumbnails always stay.
          </>
        )}
        {mode === 'no-storage' && (
          <>Not in use yet: a photo is only taken off this device once a storage is connected and holds its own copy, so right now every photo stays.</>
        )}
        {mode === 'inside-browser' && (
          <>Not used with “{s.label ?? 'Files inside this browser'}”: its files live in this browser’s own data, so removing a photo here would not free any space.</>
        )}
        {mode === 'paused' && <>Waiting until access to {s.label ?? 'your storage'} is allowed again.</>}
      </p>
      {mode === 'applies' && usage && over > 0 && usage.unsavedBytes > 0 && (
        <p className="muted">
          {formatBytes(over)} over the limit, because {plural(usage.unsavedOriginals, 'photo hasn’t', 'photos haven’t')} reached
          storage yet. They stay until they have.
        </p>
      )}
    </div>
  )
}
