import { strToU8, zipSync } from 'fflate'
import { useMemo } from 'react'
import type { Entry } from '../lib/entry'
import { dayFilePath, serializeDay } from '../lib/markdown'
import { StorageCard } from './StorageCard'

export type Theme = 'system' | 'light' | 'dark'

function exportZip(entries: Entry[]) {
  const days = [...new Set(entries.map((e) => e.day))].sort()
  const files: Record<string, Uint8Array> = {}
  for (const d of days) files[`InterstitialDiary/${dayFilePath(d)}`] = strToU8(serializeDay(d, entries))
  const blob = new Blob([zipSync(files) as BlobPart], { type: 'application/zip' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `interstitial-diary-${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function SettingsView({ entries, theme, setTheme, tagCount }: {
  entries: Entry[]
  theme: Theme
  setTheme: (t: Theme) => void
  tagCount: number
}) {
  const dayCount = useMemo(() => new Set(entries.map((e) => e.day)).size, [entries])
  return (
    <section className="settings">
      <h2>Settings</h2>

      <StorageCard />

      <div className="card">
        <h3>Appearance</h3>
        <div className="seg">
          {(['system', 'light', 'dark'] as Theme[]).map((t) => (
            <button key={t} type="button" className={theme === t ? 'on' : ''} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Your data</h3>
        <p>{entries.length} entries over {dayCount} days, {tagCount} tags.</p>
        <button type="button" onClick={() => exportZip(entries)} disabled={!entries.length}>Export as Markdown (.zip)</button>
        <p className="muted">One Markdown file per day, the same format used by every storage option.</p>
      </div>

      <div className="card">
        <h3>Keyboard shortcuts</h3>
        <table>
          <tbody>
            <tr><td><kbd>n</kbd></td><td>Write a new entry</td></tr>
            <tr><td><kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd></td><td>Search</td></tr>
            <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Previous / next day</td></tr>
            <tr><td><kbd>t</kbd></td><td>Jump to today</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Clear search</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
