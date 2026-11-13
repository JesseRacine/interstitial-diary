import { useMemo, useState } from 'react'
import { type Entry, MONTH_NAMES, dayKey, shortDayLabel } from '../lib/entry'
import { displayName, tagKindOf, tagToken } from '../lib/tagKinds'
import { type SearchIndex, type TagStat, runSearch } from '../search/engine'
import { parseQuery } from '../search/query'
import { EntryItem } from './EntryItem'
import { Histogram } from './Results'

const PAGE = 100

/** "2026-03" gives "March 2026"; "2026" stays "2026". */
const monthLabel = (m: string) => (m.length === 4 ? m : `${MONTH_NAMES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`)

/**
 * Everything about one person or place: how often and when they appear, and their entries, newest first.
 * Clicking a bar of the chart shows only that month; clicking it again shows all.
 */
export function TagPage({ tag, stat, entries, index, backLabel, onBack, onSearch, onOpenDay, onOpenImage }: {
  tag: string // stored key, e.g. `@sarah_jones`
  stat: TagStat | undefined // undefined once no entry has it any more (renamed, merged or deleted while open)
  entries: Entry[]
  index: SearchIndex
  backLabel: string
  onBack: () => void
  onSearch: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const kind = tagKindOf(tag)
  const [month, setMonth] = useState<string | null>(null)
  const [limit, setLimit] = useState(PAGE)
  const hits = useMemo(() => runSearch(parseQuery(tagToken(tag)), entries, index, 'newest'), [tag, entries, index])
  const shown = useMemo(() => (month ? hits.filter((h) => h.entry.day.startsWith(month)) : hits), [hits, month])

  return (
    <section className="tag-page" data-kind={kind.id}>
      <button type="button" className="ghost back" onClick={onBack}>← {backLabel}</button>
      <h2><span aria-hidden="true">{kind.icon}</span> {displayName(tag)}</h2>
      {stat ? (
        <>
          <p className="summary">
            {stat.count} {stat.count === 1 ? 'entry' : 'entries'} · first {shortDayLabel(dayKey(stat.first))} · last {shortDayLabel(dayKey(stat.last))}
            <span className="muted"> · written as {tagToken(tag)}</span>
          </p>
          <div className="tag-page-actions">
            <button type="button" onClick={() => onSearch(tag)}>Search these entries</button>
          </div>
          <Histogram hits={hits} onPick={(t) => { setMonth((m) => (m === t.slice(3) ? null : t.slice(3))); setLimit(PAGE) }} />
          {month && (
            <p className="muted">
              Showing {monthLabel(month)} ({shown.length}). <button type="button" className="link" onClick={() => setMonth(null)}>Show all</button>
            </p>
          )}
          <div className="timeline">
            {shown.slice(0, limit).map((h) => (
              <EntryItem key={h.entry.id} entry={h.entry} showDate onTag={onSearch} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
            ))}
            {shown.length > limit && (
              <button type="button" className="more" onClick={() => setLimit(limit + PAGE)}>Show more ({shown.length - limit} left)</button>
            )}
          </div>
        </>
      ) : (
        <p className="empty">No entries mention {displayName(tag)} any more.</p>
      )}
    </section>
  )
}
