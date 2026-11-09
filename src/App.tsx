import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { Capture } from './components/Capture'
import { JournalView, type JournalLayout, type Jump } from './components/JournalView'
import { Results } from './components/Results'
import { SearchBar } from './components/SearchBar'
import { SettingsView, type Theme } from './components/SettingsView'
import { StorageBadge } from './components/StorageCard'
import { initStorage } from './storage/manager'
import { TagsView } from './components/TagsView'
import { db, getMeta, setMeta } from './lib/db'
import { isTyping } from './lib/dom'
import type { Entry } from './lib/entry'
import { useLive } from './lib/hooks'
import { buildIndex, computeTagStats } from './search/engine'

type View = 'journal' | 'calendar' | 'tags' | 'settings'
const VIEWS: [View, string][] = [['journal', 'Journal'], ['calendar', 'Calendar'], ['tags', 'Tags'], ['settings', 'Settings']]

function loadTheme(): Theme {
  try { return (localStorage.getItem('theme') as Theme | null) ?? 'system' } catch { return 'system' }
}

function loadLayout(): JournalLayout {
  try { return localStorage.getItem('journalLayout') === 'stream' ? 'stream' : 'cards' } catch { return 'cards' }
}

export default function App() {
  const entries = useLive<Entry[]>(() => db.entries.orderBy('createdAt').filter((e) => !e.deleted).toArray(), [], [])
  const saved = useLive<string[]>(() => getMeta('savedSearches', []), [], [])
  const recent = useLive<string[]>(() => getMeta('recentSearches', []), [], [])
  const index = useMemo(() => buildIndex(entries), [entries])
  const tagStats = useMemo(() => computeTagStats(entries), [entries])

  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('view') as View | null) ?? 'journal')
  const [jump, setJump] = useState<Jump | null>(null)
  const [bottomTick, setBottomTick] = useState(0)
  const [layout, setLayoutState] = useState<JournalLayout>(loadLayout)
  const [query, setQuery] = useState('')
  const [backQuery, setBackQuery] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const searchRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { void initStorage() }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') delete root.dataset.theme
    else root.dataset.theme = theme
  }, [theme])
  const setTheme = (t: Theme) => {
    setThemeState(t)
    try { localStorage.setItem('theme', t) } catch { /* private mode */ }
  }

  const commitSearch = useCallback((q: string) => {
    const s = q.trim()
    if (s) void setMeta('recentSearches', [s, ...recent.filter((r) => r !== s)].slice(0, 8))
  }, [recent])

  const changeQuery = (q: string) => {
    setQuery(q)
    setBackQuery(null)
  }
  const searchTag = (tag: string) => {
    changeQuery(`#${tag}`)
    searchRef.current?.focus()
  }
  const setLayout = (l: JournalLayout) => {
    setLayoutState(l)
    try { localStorage.setItem('journalLayout', l) } catch { /* private mode */ }
  }
  const openDay = (d: string, id: string | null = null) => {
    setJump((j) => ({ day: d, id, n: (j?.n ?? 0) + 1 }))
    setView('journal')
  }
  const openFromResults = (e: Entry) => {
    commitSearch(query)
    setBackQuery(query)
    setQuery('')
    openDay(e.day, e.id)
  }
  const backToResults = () => {
    if (backQuery === null) return
    setQuery(backQuery)
    setBackQuery(null)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === 'n') { e.preventDefault(); setQuery(''); setView('journal'); setTimeout(() => captureRef.current?.focus()) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const searching = query.trim() !== ''

  return (
    <div className={`app${view === 'journal' && !searching ? ' fill' : ''}`}>
      <header className="top">
        <h1>Interstitial</h1>
        <nav>
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" className={view === v && !searching ? 'on' : ''}
              onClick={() => { setView(v); setQuery(''); setBackQuery(null) }}>
              {label}
            </button>
          ))}
        </nav>
        <StorageBadge onOpenSettings={() => { setView('settings'); setQuery('') }} />
      </header>

      <SearchBar query={query} setQuery={changeQuery} inputRef={searchRef} tagStats={tagStats}
        saved={saved} recent={recent} onCommit={commitSearch} />

      <main>
        {searching ? (
          <Results query={query} setQuery={changeQuery} entries={entries} index={index} onOpenDay={openFromResults} onTag={searchTag} />
        ) : view === 'journal' ? (
          <>
            <JournalView entries={entries} layout={layout} setLayout={setLayout} jump={jump} bottomTick={bottomTick}
              onTag={searchTag} backQuery={backQuery} onBack={backToResults} />
            <Capture tagStats={tagStats} inputRef={captureRef} onSaved={() => setBottomTick((t) => t + 1)} />
          </>
        ) : view === 'calendar' ? (
          <CalendarView entries={entries} onOpenDay={(d) => openDay(d)} />
        ) : view === 'tags' ? (
          <TagsView tagStats={tagStats} onSearch={searchTag} />
        ) : (
          <SettingsView entries={entries} theme={theme} setTheme={setTheme} tagCount={tagStats.length} />
        )}
      </main>
    </div>
  )
}
