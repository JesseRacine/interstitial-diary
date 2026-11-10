import type { Entry } from '../lib/entry'
import { ExportCard } from './ExportCard'
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
