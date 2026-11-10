import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { dayKey, formatGap, longDayLabel, shortDayLabel } from '../lib/entry'
import type { Entry } from '../lib/entry'
import { isTyping } from '../lib/dom'
import { buildRows, dayOnOrAfter, type Row, rowOfEntry } from '../lib/journalRows'
import { EntryItem } from './EntryItem'

export type JournalLayout = 'cards' | 'stream'
export interface Jump { day: string; id: string | null; n: number }

/** Gaps shorter than this are not worth a divider. */
const GAP_DIVIDER_MINUTES = 60

export function JournalView({ entries, layout, setLayout, jump, bottomTick, onTag, backQuery, onBack, onOpenImage }: {
  entries: Entry[]
  layout: JournalLayout
  setLayout: (l: JournalLayout) => void
  /** Ask the view to scroll to a day (and flash one entry). `n` changes on every request. */
  jump: Jump | null
  /** Changes whenever the user saves an entry, so the view can snap to the newest one. */
  bottomTick: number
  onTag: (tag: string) => void
  backQuery: string | null
  onBack: () => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const { rows, days } = useMemo(() => buildRows(entries), [entries])
  const ref = useRef<VirtuosoHandle>(null)
  const [visibleDay, setVisibleDay] = useState<string>(() => days[days.length - 1]?.day ?? dayKey(Date.now()))
  const [atBottom, setAtBottom] = useState(true)
  const [flashId, setFlashId] = useState<string | null>(null)
  const today = dayKey(Date.now())
  const [waited, setWaited] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setWaited(true), 700)
    return () => clearTimeout(t)
  }, [])

  // Where to start: the requested entry or day, otherwise the newest entry at the bottom.
  const initialIndex = useMemo(() => {
    if (jump) {
      const byId = jump.id ? rowOfEntry(rows, jump.id) : -1
      if (byId >= 0) return byId
      const d = dayOnOrAfter(days, jump.day)
      if (d) return d.index
    }
    return Math.max(0, rows.length - 1)
    // Decided once, as soon as the entries have loaded (they arrive just after the first render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length > 0])

  // The day shown in the header is the day of the first row actually on screen. (Virtuoso's own range includes
  // rows rendered off-screen as a buffer, which would make it run ahead.)
  const scroller = useRef<HTMLElement | null>(null)
  const frame = useRef(0)
  const updateVisibleDay = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      const el = scroller.current
      if (!el) return
      const top = el.getBoundingClientRect().top
      for (const r of el.querySelectorAll<HTMLElement>('[data-day]')) {
        if (r.getBoundingClientRect().bottom > top + 12) { setVisibleDay(r.dataset.day!); return }
      }
    })
  }, [])
  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  const toIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start', smooth = false) => {
    ref.current?.scrollToIndex({ index, align, behavior: smooth ? 'smooth' : 'auto' })
  }, [])
  const toBottom = useCallback(() => toIndex(Math.max(0, rows.length - 1), 'end'), [toIndex, rows.length])

  // Later jump requests (calendar, search results). The first one was handled by initialIndex.
  const handled = useRef(jump?.n)
  useEffect(() => {
    if (!jump || handled.current === jump.n) return
    handled.current = jump.n
    const byId = jump.id ? rowOfEntry(rows, jump.id) : -1
    if (byId >= 0) toIndex(byId, 'center')
    else {
      const d = dayOnOrAfter(days, jump.day)
      if (d) toIndex(d.index)
      else toBottom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jump])

  useEffect(() => {
    if (!jump?.id) return
    setFlashId(jump.id)
    const t = setTimeout(() => setFlashId(null), 2400)
    return () => clearTimeout(t)
  }, [jump])

  const firstTick = useRef(bottomTick)
  useEffect(() => {
    if (bottomTick !== firstTick.current) toBottom()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bottomTick])

  const stepDay = useCallback((dir: -1 | 1) => {
    const i = days.findIndex((d) => d.day === visibleDay)
    const target = days[i + dir]
    if (target) toIndex(target.index)
    else if (dir === 1) toBottom()
  }, [days, visibleDay, toIndex, toBottom])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'ArrowLeft') stepDay(-1)
      else if (e.key === 'ArrowRight') stepDay(1)
      else if (e.key === 't') toBottom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stepDay, toBottom])

  const itemContent = useCallback((_: number, row: Row) => {
    if (row.kind === 'day') {
      return (
        <div className="vrow day-row" data-day={row.day}>
          <div className="day-head">
            <span className="day-title">{longDayLabel(row.day)}</span>
            <span className="muted count">{row.count} {row.count === 1 ? 'entry' : 'entries'}</span>
          </div>
        </div>
      )
    }
    return (
      <div className={`vrow entry-row${row.last ? ' last' : ''}`} data-day={row.day}>
        <div className="entry-wrap">
          {row.gapMinutes !== null && row.gapMinutes >= GAP_DIVIDER_MINUTES && (
            <div className="gap-divider"><span>{formatGap(row.gapMinutes)}</span></div>
          )}
          <EntryItem entry={row.entry} bubble highlighted={row.entry.id === flashId} onTag={onTag} onOpenImage={onOpenImage} />
        </div>
      </div>
    )
  }, [flashId, onTag, onOpenImage])

  return (
    <section className={`journal-view ${layout}`}>
      {backQuery !== null && (
        <button type="button" className="link back" onClick={onBack}>← Back to results for “{backQuery}”</button>
      )}
      <div className="day-nav">
        <button type="button" onClick={() => stepDay(-1)} aria-label="Previous day" title="Previous day (←)">‹</button>
        <h2 title={longDayLabel(visibleDay)}>{shortDayLabel(visibleDay)}</h2>
        <button type="button" onClick={() => stepDay(1)} aria-label="Next day" title="Next day (→)">›</button>
        <input
          type="date"
          value={visibleDay}
          aria-label="Jump to date"
          onChange={(e) => {
            if (!e.target.value) return
            const d = dayOnOrAfter(days, e.target.value)
            if (d) toIndex(d.index)
            else toBottom()
          }}
        />
        {(!atBottom || visibleDay !== today) && <button type="button" onClick={toBottom} title="Latest (t)">Latest</button>}
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Layout">
          <button type="button" className={layout === 'cards' ? 'on' : ''} aria-pressed={layout === 'cards'}
            onClick={() => setLayout('cards')} title="Each day in its own box">Days</button>
          <button type="button" className={layout === 'stream' ? 'on' : ''} aria-pressed={layout === 'stream'}
            onClick={() => setLayout('stream')} title="One continuous chat">Stream</button>
        </div>
      </div>

      {rows.length === 0 ? (
        // Entries load a moment after the first render, so don't claim the journal is empty straight away.
        <p className="empty">{waited ? 'Nothing logged yet. Write your first note below.' : ''}</p>
      ) : (
        <Virtuoso
          ref={ref}
          className="chat"
          data={rows}
          computeItemKey={(_, r) => (r.kind === 'day' ? `d-${r.day}` : r.entry.id)}
          itemContent={itemContent}
          initialTopMostItemIndex={{ index: initialIndex, align: jump ? (jump.id ? 'center' : 'start') : 'end' }}
          followOutput={(bottom) => (bottom ? 'smooth' : false)}
          atBottomStateChange={setAtBottom}
          atBottomThreshold={80}
          increaseViewportBy={{ top: 600, bottom: 300 }}
          scrollerRef={(el) => { scroller.current = el instanceof HTMLElement ? el : null }}
          onScroll={updateVisibleDay}
          rangeChanged={updateVisibleDay}
        />
      )}
    </section>
  )
}
