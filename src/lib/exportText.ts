import { strToU8, zipSync } from 'fflate'
import { setMeta } from './db'
import { META_LAST_BACKUP } from './dataSafety'
import { type Entry, dayKey } from './entry'
import { dayFilePath, serializeDay } from './markdown'

export const today = () => dayKey(Date.now()) // local date (toISOString would give tomorrow's date in the evening west of UTC)

export function download(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
}

/** Text only: small, so built in memory. Used by Export and as the backup offered before "Start over". */
export function exportText(entries: Entry[]) {
  const days = [...new Set(entries.map((e) => e.day))].sort()
  const files: Record<string, Uint8Array> = {}
  for (const d of days) files[`InterstitialDiary/${dayFilePath(d)}`] = strToU8(serializeDay(d, entries))
  download(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `interstitial-diary-${today()}.zip`)
  void setMeta(META_LAST_BACKUP, Date.now()) // for the backup reminder
}
