import { useMemo, useState } from 'react'
import { type Entry, MONTH_NAMES } from '../lib/entry'
import { type Hit, runSearch, type SearchIndex, type SortMode } from '../search/engine'
import { isEmptyQuery, parseQuery, toggleToken } from '../search/query'
import { EntryItem } from './EntryItem'

const PAGE = 100

function Histogram({ hits, onPick }: { hits: Hit[]; onPick: (token: string) => void }) {
  const bins = useMemo(() => {
    if (hits.length < 2) return []
    const days = hits.map((h) => h.entry.day).sort()
    const first = days[0]
    const last = days[days.length - 1]
    const [fy, fm] = first.split('-').map(Number)
    const [ly, lm] = last.split('-').map(Number)
    const months = (ly - fy) * 12 + (lm - fm) + 1
    const byYear = months > 36
    const counts = new Map<string, number>()
    for (const d of days) {
      const k = byYear ? d.slice(0, 4) : d.slice(0, 7)
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    const keys: string[] = []
    if (byYear) for (let y = fy; y <= ly; y++) keys.push(String(y))
    else for (let i = 0; i < months; i++) {
      const y = fy + Math.floor((fm - 1 + i) / 12)
      const m = ((fm - 1 + i) % 12) + 1
      keys.push(`${y}-${String(m).padStart(2, '0')}`)
    }
    return keys.map((k) => ({ key: k, count: counts.get(k) ?? 0 }))
  }, [hits])
  if (bins.length < 2) return null
  const max = Math.max(...bins.map((b) => b.count))
  const label = (k: string) => (k.length === 4 ? k : `${MONTH_NAMES[Number(k.slice(5)) - 1].slice(0, 3)} ${k.slice(0, 4)}`)
  return (
    <div className="histogram" aria-label="Matches over time">
      {bins.map((b) => (
        <button key={b.key} type="button" className="bar" title={`${label(b.key)}: ${b.count}`} onClick={() => onPick(`in:${b.key}`)}>
          <span style={{ height: `${(b.count / max) * 100}%` }} />
        </button>
      ))}
      <div className="histogram-axis muted"><span>{label(bins[0].key)}</span><span>{label(bins[bins.length - 1].key)}</span></div>
    </div>
  )
}

export function Results({ query, setQuery, entries, index, onOpenDay, onTag, onOpenImage }: {
  query: string
  setQuery: (q: string) => void
  entries: Entry[]
  index: SearchIndex
  onOpenDay: (e: Entry) => void
  onTag: (tag: string) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const [sort, setSort] = useState<SortMode>('relevance')
  const [limit, setLimit] = useState(PAGE)
  const parsed = useMemo(() => parseQuery(query), [query])
  const hits = useMemo(() => (isEmptyQuery(parsed) ? [] : runSearch(parsed, entries, index, sort)), [parsed, entries, index, sort])

  return (
    <section className="results">
      <div className="results-head">
        <strong>{hits.length} {hits.length === 1 ? 'match' : 'matches'}</strong>
        <span className="spacer" />
        <label className="muted">
          Sort{' '}
          <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="relevance">Best match</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {parsed.errors.map((err) => <p key={err} className="error">{err}. Press ? for the search syntax.</p>)}
      <Histogram hits={hits} onPick={(t) => setQuery(toggleToken(query, t))} />
      {hits.length === 0 ? (
        <p className="empty">No entries match.</p>
      ) : (
        <div className="timeline">
          {hits.slice(0, limit).map((h) => (
            <EntryItem key={h.entry.id} entry={h.entry} terms={h.terms} showDate onTag={onTag} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
          ))}
          {hits.length > limit && (
            <button type="button" className="more" onClick={() => setLimit(limit + PAGE)}>Show more ({hits.length - limit} left)</button>
          )}
        </div>
      )}
    </section>
  )
}
