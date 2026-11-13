import { useEffect, useRef, useState } from 'react'
import { setMeta } from '../lib/db'
import type { TagStat } from '../search/engine'
import { hasToken, toggleToken } from '../search/query'
import { tagLabel, tagToken } from '../lib/tagKinds'
import { Suggestions, useTagAutocomplete } from './text'

const QUICK: [label: string, token: string][] = [
  ['Today', 'today'],
  ['Yesterday', 'yesterday'],
  ['Last 7 days', 'last:7d'],
  ['Last 30 days', 'last:30d'],
  ['Mornings', 'time:05-12'],
  ['Afternoons', 'time:12-18'],
  ['Evenings', 'time:18-24'],
  ['Late night', 'time:22-05'],
  ['Weekends', 'day:weekend'],
  ['With photos', 'has:image'],
]

const SYNTAX: [string, string][] = [
  ['report draft', 'all of these words (also matches “drafting”, small typos)'],
  ['"email triage"', 'this exact phrase'],
  ['#work #tired', 'has both tags'],
  ['#work|#personal', 'has either tag'],
  ['@sarah  ~home', 'mentions a person / a place (names with spaces: @sarah_jones)'],
  ['@sarah|@tom  #work|~home', 'either one (#, @ and ~ can be mixed)'],
  ['-#personal  -@sarah  -meeting', 'leave out a tag, person, place or word'],
  ['on:2026-11-08', 'a specific day'],
  ['from:2026-11-01 to:2026-11-07', 'a date range (dates, months or years)'],
  ['in:2026-11  in:2026', 'a month or year'],
  ['today  yesterday  last:7d  last:3m', 'relative dates (d, w, m, y)'],
  ['time:09-12  after:22:00  before:7', 'time of day'],
  ['day:mon  day:weekend  day:mon,fri', 'day of the week'],
  ['has:image  -has:image', 'entries with photos / without photos (has:photo works too)'],
]

export function SearchBar({ query, setQuery, inputRef, tagStats, saved, recent, onCommit }: {
  query: string
  setQuery: (q: string) => void
  inputRef: React.RefObject<HTMLInputElement | null>
  tagStats: TagStat[]
  saved: string[]
  recent: string[]
  onCommit: (q: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [caret, setCaret] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)
  const ac = useTagAutocomplete(query, caret, tagStats)
  const pending = useRef<number | null>(null)
  useEffect(() => {
    if (pending.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pending.current, pending.current)
      pending.current = null
    }
  })

  const pick = (tag: string) => {
    const r = ac.apply(tag)
    setQuery(r.text)
    setCaret(r.caret)
    pending.current = r.caret
  }
  const chip = (token: string) => {
    setQuery(toggleToken(query, token))
    inputRef.current?.focus()
  }
  const isSaved = query.trim() !== '' && saved.includes(query.trim())
  const toggleSaved = () => {
    const q = query.trim()
    if (!q) return
    void setMeta('savedSearches', isSaved ? saved.filter((s) => s !== q) : [q, ...saved])
  }

  return (
    <div
      className="search"
      ref={wrap}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!wrap.current?.contains(e.relatedTarget as Node)) setOpen(false) }}
    >
      <div className="search-row field">
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search…  try  #work tired last:7d"
          aria-label="Search entries"
          onChange={(e) => { setQuery(e.target.value); setCaret(e.target.selectionStart ?? 0) }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={(e) => {
            const tag = ac.onKey(e)
            if (tag) return pick(tag)
            if (e.defaultPrevented) return
            if (e.key === 'Enter') onCommit(query)
            if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur() }
          }}
        />
        <button type="button" className={`icon${isSaved ? ' on' : ''}`} onClick={toggleSaved} disabled={!query.trim()}
          title={isSaved ? 'Remove from saved searches' : 'Save this search'} aria-label="Save search">
          {isSaved ? '★' : '☆'}
        </button>
        <button type="button" className={`icon${help ? ' on' : ''}`} onClick={() => setHelp(!help)} title="Search syntax" aria-label="Search help">?</button>
        <Suggestions items={ac.suggestions} index={ac.index} onPick={pick} />
      </div>

      {(open || query) && (
        <div className="chips">
          {saved.map((s) => (
            <button key={`s-${s}`} type="button" className={`chip saved${query.trim() === s ? ' on' : ''}`} onClick={() => setQuery(s)}>★ {s}</button>
          ))}
          {QUICK.map(([label, token]) => (
            <button key={token} type="button" className={`chip${hasToken(query, token) ? ' on' : ''}`} onClick={() => chip(token)}>{label}</button>
          ))}
          {tagStats.slice(0, 6).map((t) => (
            <button key={t.tag} type="button" className={`chip tagchip${hasToken(query, tagToken(t.tag)) ? ' on' : ''}`} onClick={() => chip(tagToken(t.tag))}>{tagLabel(t.tag)}</button>
          ))}
        </div>
      )}

      {open && !query && recent.length > 0 && (
        <div className="recent">
          <span className="muted">Recent:</span>
          {recent.map((r) => (
            <button key={r} type="button" className="link" onClick={() => setQuery(r)}>{r}</button>
          ))}
        </div>
      )}

      {help && (
        <div className="help">
          <table>
            <tbody>
              {SYNTAX.map(([q, d]) => (
                <tr key={q}><td><code>{q}</code></td><td>{d}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted">Combine freely, e.g. <code>#work tired time:13-17 last:30d</code>. Press <kbd>/</kbd> or <kbd>Ctrl</kbd>+<kbd>K</kbd> to search, <kbd>Esc</kbd> to clear.</p>
        </div>
      )}
    </div>
  )
}
