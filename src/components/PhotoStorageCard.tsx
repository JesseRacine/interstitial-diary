import { useEffect, useState } from 'react'
import { getOriginalsLimit, photoUsage, setOriginalsLimit } from '../lib/db'
import { useLive } from '../lib/hooks'
import { formatBytes } from '../lib/images'
import type { CleanupResult } from '../storage/cleanup'
import {
  type ImageCleanupPlan, applyOriginalsLimit, planImageCleanup, removeImagesOfDeletedEntries, useOriginalsLimitMode, useStorage,
} from '../storage/manager'
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

type Cleanup =
  | { step: 'idle' }
  | { step: 'checking' }
  | { step: 'plan'; plan: ImageCleanupPlan }
  | { step: 'removing'; plan: ImageCleanupPlan }
  | { step: 'done'; result: CleanupResult }
  | { step: 'error'; message: string }

/**
 * Photos only deleted entries used. Deleting an entry never deletes its photo files; this is the one place that does,
 * after a check and a confirmation that says it can't be undone (rules in storage/cleanup.ts).
 */
function DeletedEntryPhotos() {
  const [c, setC] = useState<Cleanup>({ step: 'idle' })
  const busy = c.step === 'checking' || c.step === 'removing'

  const look = async () => {
    setC({ step: 'checking' })
    try {
      setC({ step: 'plan', plan: await planImageCleanup() })
    } catch (e) {
      setC({ step: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }
  const remove = async (plan: ImageCleanupPlan) => {
    setC({ step: 'removing', plan })
    try {
      setC({ step: 'done', result: await removeImagesOfDeletedEntries(plan.hashes) })
    } catch (e) {
      setC({ step: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }
  const close = () => setC({ step: 'idle' })

  const plan = c.step === 'plan' || c.step === 'removing' ? c.plan : null
  const where = plan?.storageLabel ?? 'storage'

  return (
    <div className="cleanup">
      <h4>Photos of deleted entries</h4>
      {c.step === 'idle' && (
        <>
          <p className="muted">
            Deleting an entry keeps its photo files, in case you want them. Photos that only deleted entries use can be removed
            to free space.
          </p>
          <button type="button" onClick={() => void look()}>Look for photos to remove</button>
        </>
      )}
      {c.step === 'checking' && <p className="muted" role="status">Checking… (saving to storage first, so the latest entries are included)</p>}

      {plan && plan.hashes.length === 0 && (
        <>
          <p>Nothing to remove: every photo is used by an entry you still have.</p>
          <button type="button" onClick={close}>OK</button>
        </>
      )}
      {plan && plan.hashes.length > 0 && (
        <div role="alertdialog" aria-label="Confirm removing photos">
          <p>
            <strong>{plural(plan.hashes.length, 'photo is', 'photos are')}</strong> only used by entries you deleted. Removing{' '}
            {plan.hashes.length === 1 ? 'it' : 'them'} frees about <strong>{formatBytes(plan.storageBytes + plan.localBytes)}</strong>
            {plan.storageBytes > 0 && plan.localBytes > 0 && <>: {formatBytes(plan.storageBytes)} in {where} and {formatBytes(plan.localBytes)} on this device</>}
            {plan.storageBytes > 0 && plan.localBytes === 0 && <> in {where}</>}
            {plan.storageBytes === 0 && plan.localBytes > 0 && <> on this device</>}.
          </p>
          <p className="error">This can’t be undone. The photo files are deleted for good.</p>
          {!plan.storageRemovable && <p className="muted">{where} can’t delete files, so only this device is cleaned.</p>}
          <p className="muted">Other devices keep whatever they already have. Let them finish syncing first.</p>
          <div className="row">
            <button type="button" className="remove" disabled={busy} onClick={() => void remove(plan)}>
              {c.step === 'removing' ? 'Removing…' : `Remove ${plural(plan.hashes.length, 'photo', 'photos')}`}
            </button>
            <button type="button" disabled={busy} onClick={close}>Cancel</button>
          </div>
        </div>
      )}

      {c.step === 'done' && (
        <>
          <p role="status">
            {c.result.removed > 0
              ? <>Removed {plural(c.result.removed, 'photo', 'photos')}, freeing about {formatBytes(c.result.freedBytes)}.</>
              : <>No photos were removed.</>}
          </p>
          {c.result.errors.length > 0 && (
            <p className="error">
              Some files couldn’t be removed and were left as they were ({c.result.errors[0]}). You can try again.
            </p>
          )}
          <button type="button" onClick={close}>OK</button>
        </>
      )}
      {c.step === 'error' && (
        <>
          <p className="error">{c.message}</p>
          <button type="button" onClick={close}>OK</button>
        </>
      )}
    </div>
  )
}

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

      <DeletedEntryPhotos />
    </div>
  )
}
