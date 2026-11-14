import type { Entry } from '../lib/entry'
import { DataSafetyCard } from './DataSafetyCard'
import { ExportCard } from './ExportCard'
import { PhotoStorageCard } from './PhotoStorageCard'
import { StartOverCard } from './StartOverCard'
import { StorageCard } from './StorageCard'

export type Theme = 'system' | 'light' | 'dark'

export function SettingsView({ entries, theme, setTheme, tagCount }: {
  entries: Entry[]
  theme: Theme
  setTheme: (t: Theme) => void
  tagCount: number
}) {
  return (
    <section className="settings">
      <h2>Settings</h2>

      <StorageCard />

      <DataSafetyCard />

      <PhotoStorageCard />

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

      <ExportCard entries={entries} tagCount={tagCount} />

      <StartOverCard entries={entries} />

      <div className="card">
        <h3>Quick entry from your phone or taskbar</h3>
        <p className="muted">With the app installed:</p>
        <ul>
          <li><strong>Android home screen:</strong> long-press the app icon, then drag <strong>New entry</strong> onto the home
            screen. One tap opens the app ready to type.</li>
          <li><strong>From another app:</strong> tap Share, then <strong>Interstitial</strong> (Chrome, Maps and most apps). The
            text or link lands in a new entry for you to finish and save. If Interstitial is not in the list, reinstall the app
            once. Photos cannot be shared in yet.</li>
          <li><strong>Windows:</strong> right-click the app icon in the taskbar and choose <strong>New entry</strong>.</li>
        </ul>
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
            <tr><td>Photo viewer</td><td><kbd>←</kbd> <kbd>→</kbd> other photos · <kbd>+</kbd> <kbd>−</kbd> <kbd>0</kbd> zoom · <kbd>Esc</kbd> close</td></tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
