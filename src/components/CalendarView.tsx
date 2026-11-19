import { useMemo, useState } from 'react'
import { addDays, dayKey, type Entry, MONTH_NAMES, pad } from '../lib/entry'
import { eventDateLabel } from '../lib/eventRows'
import type { EventStat } from '../lib/events'
import type { CalMode } from '../lib/startView'
import { buildWeekReview, weekStart } from '../lib/weekReview'
import { countByDay } from '../search/engine'
import { EventsView } from './EventsView'
import { WeekReview } from './WeekReview'

const WEEK_HEAD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function level(count: number, max: number): number {
  if (!count) return 0
  if (max <= 4) return Math.min(4, count)
  return Math.min(4, Math.ceil((count / max) * 4))
}

function Month({ y, m, counts, max, compact, today, onOpenDay }: {
  y: number; m: number; counts: Map<string, number>; max: number; compact?: boolean; today: string
  onOpenDay: (day: string) => void
}) {
  const first = new Date(y, m, 1)
  const lead = first.getDay() // Sunday-first (getDay(): 0 = Sunday)
  const days = new Date(y, m + 1, 0).getDate()
  const cells: (string | null)[] = [...Array(lead).fill(null)]
  for (let d = 1; d <= days; d++) cells.push(`${y}-${pad(m + 1)}-${pad(d)}`)
  const total = cells.reduce((s, k) => s + (k ? counts.get(k) ?? 0 : 0), 0)

  return (
    <div className={`month${compact ? ' compact' : ''}`}>
      {compact && <div className="month-title">{MONTH_NAMES[m].slice(0, 3)} <span className="muted">{total || ''}</span></div>}
      <div className="grid">
        {!compact && WEEK_HEAD.map((w) => <div key={w} className="dow muted">{w}</div>)}
        {cells.map((k, i) => {
          if (!k) return <div key={`x${i}`} />
          const c = counts.get(k) ?? 0
          return (
            <button key={k} type="button" className={`cell heat-${level(c, max)}${k === today ? ' today' : ''}`}
              onClick={() => onOpenDay(k)} title={`${k}: ${c} ${c === 1 ? 'entry' : 'entries'}`}>
              {!compact && <><span className="num">{Number(k.slice(8))}</span>{c > 0 && <span className="cnt">{c}</span>}</>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const MODES: [CalMode, string][] = [['month', 'Month'], ['year', 'Year'], ['week', 'Week'], ['events', 'Events']]

export function CalendarView({ entries, events, mode, onMode, eventId, onSelectEvent, onOpenDay, onOpenEntryDay, onOpenImage, onTag, onSearchQuery, onOpenEvent }: {
  entries: Entry[]
  events: EventStat[]
  /** Kept by App so an event chip anywhere in the app can open Calendar on the Events page. */
  mode: CalMode
  onMode: (mode: CalMode) => void
  /** The event whose page is open in Events mode (kept by App too). */
  eventId: string | null
  onSelectEvent: (id: string | null) => void
  onOpenDay: (day: string) => void
  onOpenEntryDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
  onTag: (tag: string) => void
  onSearchQuery: (query: string) => void
  onOpenEvent: (id: string) => void
}) {
  const counts = useMemo(() => countByDay(entries), [entries])
  const now = new Date()
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth())
  const today = dayKey(now)
  const thisWeek = weekStart(today)
  const [week, setWeek] = useState(thisWeek) // the Sunday of the week shown in Week mode
  const review = useMemo(() => (mode === 'week' ? buildWeekReview(entries, week, events) : null), [mode, entries, week, events])

  const prefix = mode === 'month' ? `${y}-${pad(m + 1)}` : `${y}`
  let max = 0
  let total = 0
  let activeDays = 0
  for (const [k, c] of counts) if (k.startsWith(prefix)) { max = Math.max(max, c); total += c; activeDays++ }

  const step = (dir: number) => {
    if (mode === 'week') return setWeek(addDays(week, dir * 7))
    if (mode === 'year') return setY(y + dir)
    const d = new Date(y, m + dir, 1)
    setY(d.getFullYear())
    setM(d.getMonth())
  }

  // Leaving Events closes any open event page, so coming back shows the list.
  const switcher = (
    <div className="seg" role="group" aria-label="Calendar view">
      {MODES.map(([k, label]) => (
        <button key={k} type="button" className={mode === k ? 'on' : ''} aria-pressed={mode === k}
          onClick={() => { onSelectEvent(null); onMode(k) }}>{label}</button>
      ))}
    </div>
  )

  if (mode === 'events') {
    return (
      <section className="calendar">
        <div className="day-nav">{switcher}</div>
        <EventsView events={events} entries={entries} selectedId={eventId} onSelect={onSelectEvent} onSearch={onTag} onSearchQuery={onSearchQuery}
          onOpenDay={onOpenEntryDay} onOpenImage={onOpenImage} />
      </section>
    )
  }

  return (
    <section className="calendar">
      <div className="day-nav">
        <button type="button" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <h2>{mode === 'week' ? `Week of ${eventDateLabel(week, addDays(week, 6))}` : mode === 'month' ? `${MONTH_NAMES[m]} ${y}` : y}</h2>
        <button type="button" onClick={() => step(1)} aria-label="Next" disabled={mode === 'week' && week >= thisWeek}>›</button>
        {mode === 'week' && week !== thisWeek && <button type="button" onClick={() => setWeek(thisWeek)}>This week</button>}
        {switcher}
        {review ? (
          <span className="muted count">{review.total} {review.total === 1 ? 'entry' : 'entries'}</span>
        ) : (
          <span className="muted count">{total} entries · {activeDays} days</span>
        )}
      </div>
      {review ? (
        <WeekReview review={review} onOpenDay={onOpenDay} onTag={onTag} onOpenEvent={onOpenEvent} />
      ) : mode === 'month' ? (
        <Month y={y} m={m} counts={counts} max={max} today={today} onOpenDay={onOpenDay} />
      ) : (
        <div className="year">
          {MONTH_NAMES.map((_, i) => (
            <Month key={i} y={y} m={i} counts={counts} max={max} compact today={today} onOpenDay={onOpenDay} />
          ))}
        </div>
      )}
      {!review && (
        <div className="legend muted">
          Fewer {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`cell heat-${l}`} />)} More
        </div>
      )}
    </section>
  )
}
