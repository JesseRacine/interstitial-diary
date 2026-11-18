import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BackupReminder } from './components/BackupReminder'
import { CalendarView } from './components/CalendarView'
import { Capture } from './components/Capture'
import { OpenEventContext, OpenTrackingContext } from './components/eventNav'
import { JournalView, type JournalLayout, type Jump } from './components/JournalView'
import { Lightbox } from './components/Lightbox'
import { PhotosView } from './components/PhotosView'
import { Results } from './components/Results'
import { SearchBar } from './components/SearchBar'
import { SettingsView, type Theme } from './components/SettingsView'
import { StorageBadge } from './components/StorageCard'
import { initStorage } from './storage/manager'
import { TagsView } from './components/TagsView'
import { TrackingView } from './components/TrackingView'
import { UpdatePrompt } from './components/UpdatePrompt'
import { db, getMeta, setMeta } from './lib/db'
import { isTyping } from './lib/dom'
import type { Entry } from './lib/entry'
import { useLive } from './lib/hooks'
import { cleanLaunchUrl, parseLaunch } from './lib/launch'
import { computeEvents, eventOfMarker } from './lib/events'
import { type CalMode, type View, viewFromAddress } from './lib/startView'
import { computeNotes, journalEntries } from './lib/notes'
import { computeTracking } from './lib/tracking'
import { tagToken } from './lib/tagKinds'
import { buildIndex, computeTagStats } from './search/engine'

// Settings is not a tab: it is the gear next to the storage badge. Events lives inside Calendar.
const VIEWS: [View, string][] = [['journal', 'Journal'], ['calendar', 'Calendar'], ['photos', 'Photos'], ['tags', 'Tags'], ['tracking', 'Tracking']]

function loadTheme(): Theme {
  try { return (localStorage.getItem('theme') as Theme | null) ?? 'system' } catch { return 'system' }
}

function loadLayout(): JournalLayout {
  try { return localStorage.getItem('journalLayout') === 'stream' ? 'stream' : 'cards' } catch { return 'cards' }
}

export default function App() {
  // `entries` is every live entry, notes on people and places included (search, export, backup, the photo viewer).
  // `journal` leaves the notes out: a note has no day that matters, so the journal, calendar, week review, photos,
  // events and tracking never see it (see lib/notes.ts and person-notes-plan.md).
  const entries = useLive<Entry[]>(() => db.entries.orderBy('createdAt').filter((e) => !e.deleted).toArray(), [], [])
  const journal = useMemo(() => journalEntries(entries), [entries])
  const saved = useLive<string[]>(() => getMeta('savedSearches', []), [], [])
  const recent = useLive<string[]>(() => getMeta('recentSearches', []), [], [])
  const index = useMemo(() => buildIndex(entries), [entries])
  const tagStats = useMemo(() => computeTagStats(entries), [entries])
  const events = useMemo(() => computeEvents(journal), [journal])
  const tracking = useMemo(() => computeTracking(journal), [journal])
  const notes = useMemo(() => computeNotes(entries), [entries])

  // How the app was opened: the "New entry" shortcut or Android's Share sheet (see lib/launch.ts).
  const [launch] = useState(() => parseLaunch(location.search))
  const [prefill, setPrefill] = useState(launch.text) // shared text for the entry box, used once
  const [start] = useState(() => (launch.newEntry ? { view: 'journal' as View, calMode: 'month' as CalMode } : viewFromAddress(location.search)))
  const [view, setView] = useState<View>(start.view)
  const [calMode, setCalMode] = useState<CalMode>(start.calMode) // Month | Year | Week | Events, remembered while the app is open
  useEffect(() => {
    // Read once; take the launch words out of the address so a reload does not bring the shared text back.
    if (launch.newEntry) history.replaceState(history.state, '', cleanLaunchUrl(location.href))
  }, [launch])
  const [eventId, setEventId] = useState<string | null>(null) // the event whose page is open in Calendar > Events
  const [trackId, setTrackId] = useState<string | null>(null) // the tracked item (an entry's id) whose page is open in Tracking
  const [jump, setJump] = useState<Jump | null>(null)
  const [bottomTick, setBottomTick] = useState(0)
  const [layout, setLayoutState] = useState<JournalLayout>(loadLayout)
  const [query, setQuery] = useState('')
  const [backQuery, setBackQuery] = useState<string | null>(null)
  const [theme, setThemeState] = useState<Theme>(loadTheme)
  const [photo, setPhoto] = useState<{ entryId: string; index: number } | null>(null)
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
  const searchFor = (q: string) => {
    changeQuery(q)
    searchRef.current?.focus()
  }
  const searchTag = (tag: string) => searchFor(tagToken(tag))
  const setLayout = (l: JournalLayout) => {
    setLayoutState(l)
    try { localStorage.setItem('journalLayout', l) } catch { /* private mode */ }
  }
  /** Open the page of the event that `title` (and `date`, if the marker has one) names in this entry. */
  const openEvent = useCallback((entry: Entry, title: string, date?: string) => {
    const found = eventOfMarker(events, entry.id, title, date)
    if (!found) return
    setEventId(found.id)
    setCalMode('events')
    setView('calendar')
    setQuery('')
    setBackQuery(null)
  }, [events])
  /** Open the Tracking page on the item that a chip in this entry names. */
  const openTracking = useCallback((entry: Entry) => {
    setTrackId(entry.id)
    setView('tracking')
    setQuery('')
    setBackQuery(null)
  }, [])
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

  // The photo viewer is a history entry, so the browser's / Android's back button closes it.
  const openPhoto = useCallback((e: Pick<Entry, 'id'>, index: number) => {
    history.pushState({ photo: true }, '')
    setPhoto({ entryId: e.id, index })
  }, [])
  const closePhoto = useCallback(() => {
    if (history.state?.photo) history.back() // popstate below clears it
    else setPhoto(null)
  }, [])
  useEffect(() => {
    const onPop = () => setPhoto(null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  // Not shown if the entry was deleted (e.g. by a sync) while open; the viewer closes itself when its last photo is removed.
  const photoEntry = photo ? entries.find((e) => e.id === photo.entryId && e.images?.length) : undefined

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
    <OpenEventContext.Provider value={openEvent}>
    <OpenTrackingContext.Provider value={openTracking}>
    <div className={`app${(view === 'journal' || view === 'photos') && !searching ? ' fill' : ''}`}>
      <header className="top">
        <h1>Interstitial</h1>
        <nav>
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" className={view === v && !searching ? 'on' : ''}
              onClick={() => { setView(v); setQuery(''); setBackQuery(null); setEventId(null); setTrackId(null) }}>
              {label}
            </button>
          ))}
        </nav>
        <div className="top-end">
          <StorageBadge onOpenSettings={() => { setView('settings'); setQuery('') }} />
          <button type="button" className={`gear${view === 'settings' && !searching ? ' on' : ''}`} aria-label="Settings" title="Settings"
            onClick={() => { setView('settings'); setQuery(''); setBackQuery(null); setEventId(null) }}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      <BackupReminder entries={entries} onBackUp={() => { setView('settings'); setQuery('') }} />

      <SearchBar query={query} setQuery={changeQuery} inputRef={searchRef} tagStats={tagStats}
        saved={saved} recent={recent} onCommit={commitSearch} />

      <main>
        {searching ? (
          <Results query={query} setQuery={changeQuery} entries={entries} index={index} onOpenDay={openFromResults} onTag={searchTag}
            onOpenImage={openPhoto} />
        ) : view === 'journal' ? (
          <>
            <JournalView entries={journal} layout={layout} setLayout={setLayout} jump={jump} bottomTick={bottomTick}
              onTag={searchTag} backQuery={backQuery} onBack={backToResults} onOpenImage={openPhoto} />
            <Capture tagStats={tagStats} inputRef={captureRef} initialText={prefill} onPrefilled={() => setPrefill('')}
              onSaved={() => setBottomTick((t) => t + 1)} />
          </>
        ) : view === 'calendar' ? (
          <CalendarView entries={journal} events={events} mode={calMode} onMode={setCalMode}
            eventId={eventId} onSelectEvent={setEventId} onOpenDay={(d) => openDay(d)} onOpenEntryDay={(e) => openDay(e.day, e.id)}
            onOpenImage={openPhoto} onTag={searchTag} onSearchQuery={searchFor}
            onOpenEvent={(id) => { setEventId(id); setCalMode('events'); setQuery(''); setBackQuery(null) }} />
        ) : view === 'photos' ? (
          <PhotosView entries={journal} index={index} onOpenImage={openPhoto} onOpenDay={(d) => openDay(d)} />
        ) : view === 'tags' ? (
          <TagsView tagStats={tagStats} entries={journal} notes={notes} index={index} onSearch={searchTag}
            onOpenDay={(e) => openDay(e.day, e.id)} onOpenImage={openPhoto} />
        ) : view === 'tracking' ? (
          <TrackingView entries={journal} items={tracking} openId={trackId} onOpenId={setTrackId} onTag={searchTag} onOpenDay={(e) => openDay(e.day, e.id)} onOpenImage={openPhoto} />
        ) : (
          <SettingsView entries={entries} theme={theme} setTheme={setTheme} tagCount={tagStats.length} />
        )}
      </main>
      {photo && photoEntry && (
        <Lightbox entry={photoEntry} index={photo.index} onIndex={(index) => setPhoto({ ...photo, index })} onClose={closePhoto} />
      )}
      <UpdatePrompt />
    </div>
    </OpenTrackingContext.Provider>
    </OpenEventContext.Provider>
  )
}
