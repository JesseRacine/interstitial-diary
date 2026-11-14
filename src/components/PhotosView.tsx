import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { type Entry, longDayLabel, timeLabel } from '../lib/entry'
import { filterPhotoEntries, photoCount, photoTopTags, photoYears, setYearOfQuery, yearOfQuery } from '../lib/photoFilter'
import { type PhotoRow, buildPhotoRows, columnsFor } from '../lib/photoRows'
import { tagLabel, tagToken } from '../lib/tagKinds'
import type { SearchIndex } from '../search/engine'
import { hasToken, toggleToken } from '../search/query'
import { Thumb } from './Thumb'

/**
 * Every photo in the journal as a grid of square thumbnails, newest day first. Virtualised like the journal, so a few
 * thousand photos only put the visible rows in the DOM. A tile opens the viewer (the entry's photos, at that one); a
 * day's heading opens that day in the journal. Tiles are square boxes sized by the grid width, so nothing moves when a
 * thumbnail loads.
 */
export function PhotosView({ entries, index, onOpenImage, onOpenDay }: {
  entries: Entry[]
  index: SearchIndex
  onOpenImage: (e: Entry, index: number) => void
  onOpenDay: (day: string) => void
}) {
  const [query, setQuery] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const columns = columnsFor(width)
  const result = useMemo(() => filterPhotoEntries(query, entries, index), [query, entries, index])
  const { rows, photos, entries: entryCount } = useMemo(() => buildPhotoRows(result.entries, columns), [result, columns])
  const total = useMemo(() => photoCount(entries), [entries])
  const chips = useMemo(() => photoTopTags(entries), [entries])
  const years = useMemo(() => photoYears(entries), [entries])
  const year = yearOfQuery(query)

  // Entries load a moment after the first render, so don't claim there are no photos straight away.
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 700)
    return () => clearTimeout(t)
  }, [])

  const itemContent = useCallback((_: number, row: PhotoRow) => {
    if (row.kind === 'day') {
      return (
        <div className="photo-day" data-day={row.day}>
          <button type="button" className="link" onClick={() => onOpenDay(row.day)} title="Open this day in the journal">
            {longDayLabel(row.day)}
          </button>
          <span className="muted count">{row.count} {row.count === 1 ? 'photo' : 'photos'}</span>
        </div>
      )
    }
    return (
      <div className="photo-row" style={{ '--cols': columns } as React.CSSProperties}>
        {row.tiles.map((t) => (
          <button key={t.key} type="button" className="entry-image photo-tile" onClick={() => onOpenImage(t.entry, t.index)}
            aria-label={`Open photo from ${longDayLabel(t.entry.day)}, ${timeLabel(t.entry.createdAt)}`}>
            <Thumb image={t.image} />
          </button>
        ))}
      </div>
    )
  }, [columns, onOpenImage, onOpenDay])

  return (
    <section className="photos-view">
      <div className="day-nav">
        <h2>Photos</h2>
        <span className="muted count">
          {result.filtered
            ? `${photos} of ${total} ${total === 1 ? 'photo' : 'photos'}`
            : `${photos} ${photos === 1 ? 'photo' : 'photos'} · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
        </span>
      </div>
      {total > 0 && (
        <div className="photo-filter">
          <div className="photo-filter-row">
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Filter photos"
              placeholder="Filter photos…  try  #trip @sam last:3m" title="The same words as the search bar: #tags, @people, ~places, dates, event:&quot;Title&quot;" />
            {years.length > 1 && (
              <select value={years.includes(year) ? year : ''} onChange={(e) => setQuery(setYearOfQuery(query, e.target.value))} aria-label="Year">
                <option value="">All years</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
          {chips.length > 0 && (
            <div className="chips">
              {chips.map((t) => (
                <button key={t.tag} type="button" className={`chip tagchip${hasToken(query, tagToken(t.tag)) ? ' on' : ''}`}
                  aria-pressed={hasToken(query, tagToken(t.tag))} onClick={() => setQuery(toggleToken(query, tagToken(t.tag)))}>
                  {tagLabel(t.tag)} <span className="muted">{t.count}</span>
                </button>
              ))}
            </div>
          )}
          {result.errors.map((m) => <p key={m} className="capture-notice">{m}</p>)}
        </div>
      )}
      <div className="photos-box" ref={box}>
        {rows.length === 0 ? (
          <p className="empty">
            {total > 0 && result.filtered ? (
              <>No photos match. <button type="button" className="link" onClick={() => setQuery('')}>Clear the filter</button></>
            ) : waited ? 'No photos yet. Add one with the Photo button (or paste or drop an image) in the journal.' : ''}
          </p>
        ) : (
          <Virtuoso
            key={query.trim()}
            className="photos-scroll"
            data={rows}
            computeItemKey={(_, r) => (r.kind === 'day' ? `d-${r.day}` : `t-${r.tiles[0].key}`)}
            itemContent={itemContent}
            increaseViewportBy={{ top: 600, bottom: 600 }}
          />
        )}
      </div>
    </section>
  )
}
