import { useMemo, useState } from 'react'
import { renameEvent } from '../lib/db'
import type { Entry } from '../lib/entry'
import { type EventSort, eventDateLabel, eventYears, filterEvents, groupEvents, sortEvents } from '../lib/eventRows'
import { EVENT_ICON, type EventStat, eventAfterRename, parseEventTitle } from '../lib/events'
import { EntryItem } from './EntryItem'

const SORTS: [EventSort, string][] = [['newest', 'Newest'], ['oldest', 'Oldest'], ['name', 'A–Z']]

/**
 * The Events page: every event as a row (date, title, number of entries), by month, with a title filter, a year and a
 * sort. Clicking an event opens its page: the entries that carry it, oldest first. `selectedId` is kept by App so an
 * event chip anywhere in the app can open its page here.
 */
export function EventsView({ events, entries, selectedId, onSelect, onSearch, onOpenDay, onOpenImage }: {
  events: EventStat[]
  entries: Entry[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onSearch: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<EventSort>('newest')
  const [yearChoice, setYear] = useState('')

  const years = useMemo(() => eventYears(events), [events])
  const year = years.includes(yearChoice) ? yearChoice : '' // a year with no events left is not a filter any more
  const list = useMemo(() => sortEvents(filterEvents(events, filter, year || null), sort), [events, filter, year, sort])
  const groups = useMemo(() => groupEvents(list, sort), [list, sort])

  if (selectedId !== null) {
    return (
      <EventPage key={selectedId} event={events.find((e) => e.id === selectedId)} entries={entries}
        onBack={() => onSelect(null)} onSelect={onSelect} onSearch={onSearch} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
    )
  }

  return (
    <section className="events">
      <div className="day-nav">
        <h2>Events</h2>
        <input type="search" placeholder="Filter by title" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter events by title" />
        {years.length > 1 && (
          <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year">
            <option value="">All years</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        )}
        <div className="seg" role="group" aria-label="Sort">
          {SORTS.map(([s, label]) => (
            <button key={s} type="button" className={sort === s ? 'on' : ''} aria-pressed={sort === s} onClick={() => setSort(s)}>{label}</button>
          ))}
        </div>
      </div>
      {events.length === 0 ? (
        <p className="empty">No events yet. Name something that happened in an entry, for example <code>!"Jack's 40th birthday"</code>.</p>
      ) : list.length === 0 ? (
        <p className="empty">No events match.</p>
      ) : (
        groups.map((g) => (
          <div key={g.key} className="event-group">
            {g.label && <h3>{g.label}</h3>}
            {g.events.map((e) => (
              <div key={e.id} className="event-row">
                <span className="when">{eventDateLabel(e.first, e.last)}</span>
                <button type="button" className="event-title" onClick={() => onSelect(e.id)}>
                  <span aria-hidden="true">{EVENT_ICON}</span> {e.title}
                </button>
                <span className="n">{e.count} {e.count === 1 ? 'entry' : 'entries'}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </section>
  )
}

/** One event: its dates and its entries, oldest first (the story in order). Its title can be changed (typos). */
function EventPage({ event, entries, onBack, onSelect, onSearch, onOpenDay, onOpenImage }: {
  event: EventStat | undefined // undefined once it is gone (title renamed, entries edited or deleted while open)
  entries: Entry[]
  onBack: () => void
  onSelect: (id: string | null) => void
  onSearch: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const mine = useMemo(() => {
    const ids = new Set(event?.entryIds)
    return entries.filter((e) => ids.has(e.id))
  }, [event, entries])

  /** Rewrites the title in this event's entries only; the page then follows the event to its new id. */
  const rename = async () => {
    if (!event) return
    const input = prompt('Rename this event to:', event.title)
    if (input === null) return
    const parsed = parseEventTitle(input)
    if ('error' in parsed) return alert(parsed.error)
    if (parsed.title === event.title) return
    const n = event.count
    if (!confirm(`Rename "${event.title}" to "${parsed.title}" in ${n} ${n === 1 ? 'entry' : 'entries'}?`)) return
    const after = eventAfterRename(entries, event, parsed.title)
    await renameEvent(event.entryIds, event.key, parsed.title)
    if (after) onSelect(after.id)
  }

  return (
    <section className="event-page">
      <button type="button" className="ghost back" onClick={onBack}>← Events</button>
      {event ? (
        <>
          <h2><span aria-hidden="true">{EVENT_ICON}</span> {event.title}</h2>
          <p className="summary">
            {eventDateLabel(event.first, event.last)} · {event.count} {event.count === 1 ? 'entry' : 'entries'}
          </p>
          <div className="event-page-actions">
            <button type="button" onClick={rename}>Rename event</button>
          </div>
          <div className="timeline">
            {mine.map((e) => (
              <EntryItem key={e.id} entry={e} showDate onTag={onSearch} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
            ))}
          </div>
        </>
      ) : (
        <p className="empty">This event is not in the journal any more.</p>
      )}
    </section>
  )
}
