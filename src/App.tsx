import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarView } from './components/CalendarView'
import { Capture } from './components/Capture'
import { DayView } from './components/DayView'
import { Results } from './components/Results'
import { SearchBar } from './components/SearchBar'
import { SettingsView, type Theme } from './components/SettingsView'
import { TagsView } from './components/TagsView'
import { db, getMeta, setMeta } from './lib/db'
import { addDays, dayKey, type Entry } from './lib/entry'
import { useLive } from './lib/hooks'
import { buildIndex, computeTagStats } from './search/engine'

type View = 'journal' | 'calendar' | 'tags' | 'settings'
const VIEWS: [View, string][] = [['journal', 'Journal'], ['calendar', 'Calendar'], ['tags', 'Tags'], ['settings', 'Settings']]

function loadTheme(): Theme {
  try { return (localStorage.getItem('theme') as Theme | null) ?? 'system' } catch { return 'system' }
}

function isTyping(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
}

export default function App() {
  const entries = useLive<Entry[]>(() => db.entries.orderBy('createdAt').filter((e) => !e.deleted).toArray(), [], [])
  const saved = useLive<string[]>(() => getMeta('savedSearches', []), [], [])
  const recent = useLive<string[]>(() => getMeta('recentSearches', []), [], [])
  const index = useMemo(() => buildIndex(entries), [entries])
  const tagStats = useMemo(() => computeTagStats(entries), [entries])

  const [view, setView] = useState<View>(() => (new URLSearchParams(location.search).get('view') as View | null) ?? 'journal')
  const [day, setDay] = useState(() => dayKey(Date.now()))
  const [query, setQuery] = useState('')
  const [backQuery, setBackQuery] = useState<string | null>(null)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const searchRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLTextAreaElement>(null)

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
  const openDay = (d: string, id: string | null = null) => {
    setDay(d)
    setFocusId(id)
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
      else if (view === 'journal' && !query) {
        if (e.key === 'ArrowLeft') setDay((d) => addDays(d, -1))
        else if (e.key === 'ArrowRight') setDay((d) => addDays(d, 1))
        else if (e.key === 't') setDay(dayKey(Date.now()))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, query])

  const searching = query.trim() !== ''

  return (
    <div className="app">
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
      </header>

      <SearchBar query={query} setQuery={changeQuery} inputRef={searchRef} tagStats={tagStats}
        saved={saved} recent={recent} onCommit={commitSearch} />

      <main>
        {searching ? (
          <Results query={query} setQuery={changeQuery} entries={entries} index={index} onOpenDay={openFromResults} onTag={searchTag} />
        ) : view === 'journal' ? (
          <>
            <Capture tagStats={tagStats} inputRef={captureRef} onSaved={() => { setDay(dayKey(Date.now())); setFocusId(null) }} />
            <DayView day={day} setDay={(d) => { setDay(d); setFocusId(null) }} entries={entries} focusId={focusId}
              onTag={searchTag} backQuery={backQuery} onBack={backToResults} />
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
