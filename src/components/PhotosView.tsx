import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { type Entry, longDayLabel, timeLabel } from '../lib/entry'
import { type PhotoRow, buildPhotoRows, columnsFor } from '../lib/photoRows'
import { Thumb } from './Thumb'

/**
 * Every photo in the journal as a grid of square thumbnails, newest day first. Virtualised like the journal, so a few
 * thousand photos only put the visible rows in the DOM. A tile opens the viewer (the entry's photos, at that one); a
 * day's heading opens that day in the journal. Tiles are square boxes sized by the grid width, so nothing moves when a
 * thumbnail loads.
 */
export function PhotosView({ entries, onOpenImage, onOpenDay }: {
  entries: Entry[]
  onOpenImage: (e: Entry, index: number) => void
  onOpenDay: (day: string) => void
}) {
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
  const { rows, photos, entries: entryCount } = useMemo(() => buildPhotoRows(entries, columns), [entries, columns])

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
          {photos} {photos === 1 ? 'photo' : 'photos'} · {entryCount} {entryCount === 1 ? 'entry' : 'entries'}
        </span>
      </div>
      <div className="photos-box" ref={box}>
        {rows.length === 0 ? (
          <p className="empty">
            {waited ? 'No photos yet. Add one with the Photo button (or paste or drop an image) in the journal.' : ''}
          </p>
        ) : (
          <Virtuoso
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
