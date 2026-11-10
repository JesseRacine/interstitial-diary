import { strToU8, zipSync } from 'fflate'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { type Entry, dayKey } from '../lib/entry'
import { MAX_ZIP_BYTES, type ZipSink, blobSink, planExport, writeExportZip } from '../lib/exportZip'
import { formatBytes } from '../lib/images'
import { dayFilePath, serializeDay } from '../lib/markdown'

const today = () => dayKey(Date.now()) // local date (toISOString would give tomorrow's date in the evening west of UTC)

function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

/** Text only: small, so built in memory as before. */
function exportText(entries: Entry[]) {
  const days = [...new Set(entries.map((e) => e.day))].sort()
  const files: Record<string, Uint8Array> = {}
  for (const d of days) files[`InterstitialDiary/${dayFilePath(d)}`] = strToU8(serializeDay(d, entries))
  download(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `interstitial-diary-${today()}.zip`)
}

export function ExportCard({ entries, tagCount }: { entries: Entry[]; tagCount: number }) {
  const dayCount = useMemo(() => new Set(entries.map((e) => e.day)).size, [entries])
  const hasPhotos = useMemo(() => entries.some((e) => e.images?.length), [entries])
  const [withPhotos, setWithPhotos] = useState(false)
  const [sizes, setSizes] = useState<Map<string, number> | null>(null)
  const [year, setYear] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Sizes of the originals this device has, read only when photos are wanted.
  useEffect(() => {
    if (!withPhotos) return
    let live = true
    const m = new Map<string, number>()
    void db.blobs.each((b) => { m.set(b.hash, b.size) }).then(() => { if (live) setSizes(m) })
    return () => { live = false }
  }, [withPhotos])

  const all = useMemo(() => (sizes ? planExport(entries, sizes) : null), [entries, sizes])
  const tooBig = !!all && all.photoBytes > MAX_ZIP_BYTES
  const chosenYear = tooBig && !year ? all!.years[all!.years.length - 1] : year
  const plan = useMemo(() => (sizes && chosenYear ? planExport(entries, sizes, chosenYear) : all), [entries, sizes, chosenYear, all])
  const planTooBig = !!plan && plan.photoBytes > MAX_ZIP_BYTES

  const exportPhotos = async () => {
    if (!plan) return
    const name = `interstitial-diary-${chosenYear ? `${chosenYear}-` : ''}with-photos-${today()}.zip`
    setMessage(null)
    let sink: ZipSink & { result?: () => Blob }
    try {
      // Chrome/Edge desktop: stream straight into a file. Elsewhere (Android): build a Blob, then download it.
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({ id: 'interstitial-export', suggestedName: name, types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }] })
        const w = await handle.createWritable()
        sink = { write: (c) => w.write(c as FileSystemWriteChunkType), close: () => w.close(), abort: () => w.abort() }
      } else {
        sink = blobSink()
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return // save dialog cancelled
      setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
      return
    }
    setProgress(0)
    try {
      const r = await writeExportZip(entries, plan, async (h) => (await db.blobs.get(h))?.blob ?? null, sink,
        (done, total) => setProgress(total ? done / total : 1))
      if (sink.result) download(sink.result(), name)
      setMessage(`Exported ${plan.days.length} day${plan.days.length === 1 ? '' : 's'} and ${r.photos} photo file${r.photos === 1 ? '' : 's'}.${r.skipped ? ` ${r.skipped} could not be read.` : ''}`)
    } catch (e) {
      setMessage(`Export failed: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setProgress(null)
    }
  }

  const busy = progress !== null

  return (
    <div className="card">
      <h3>Your data</h3>
      <p>
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'} over {dayCount} {dayCount === 1 ? 'day' : 'days'},{' '}
        {tagCount} {tagCount === 1 ? 'tag' : 'tags'}.
      </p>
      {hasPhotos && (
        <label className="check">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} disabled={busy} />
          Include photos
        </label>
      )}

      {withPhotos && hasPhotos ? (
        <>
          {!plan ? (
            <p className="muted">Adding up the photos…</p>
          ) : (
            <>
              {(tooBig || year) && all && (
                <p>
                  <label>
                    Export{' '}
                    <select value={chosenYear} onChange={(e) => setYear(e.target.value)} disabled={busy}>
                      {!tooBig && <option value="">All years</option>}
                      {all.years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </label>
                  {tooBig && <span className="muted"> · all photos together ({formatBytes(all.photoBytes)}) are too big for one zip</span>}
                </p>
              )}
              <p>
                {plan.days.length} day{plan.days.length === 1 ? '' : 's'}, {plan.photos.length} photo file{plan.photos.length === 1 ? '' : 's'}: about{' '}
                <strong>{formatBytes(plan.photoBytes)}</strong>.
                {plan.missing > 0 && <span className="muted"> {plan.missing} photo{plan.missing === 1 ? ' isn’t' : 's aren’t'} on this device and will be left out.</span>}
              </p>
              <div className="row">
                <button type="button" onClick={exportPhotos} disabled={busy || !entries.length || planTooBig}>
                  {busy ? `Exporting… ${Math.round(progress * 100)}%` : 'Export with photos (.zip)'}
                </button>
                {!tooBig && all && !year && all.years.length > 1 && (
                  <button type="button" className="link" onClick={() => setYear(all.years[all.years.length - 1])} disabled={busy}>One year only</button>
                )}
              </div>
              {planTooBig && <p className="error">This year alone is over 4 GB, which one zip can’t hold.</p>}
            </>
          )}
          <p className="muted">Day files plus the original photos, in the same folders as the storage folder. Photos aren’t compressed (they don’t get smaller).</p>
        </>
      ) : (
        <>
          <button type="button" onClick={() => exportText(entries)} disabled={!entries.length}>Export as Markdown (.zip)</button>
          <p className="muted">One Markdown file per day, the same format used by every storage option.</p>
        </>
      )}
      {message && <p className="muted" role="status">{message}</p>}
    </div>
  )
}
