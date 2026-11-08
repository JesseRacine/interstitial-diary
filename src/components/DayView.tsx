import { useEffect, useMemo } from 'react'
import { addDays, dayKey, type Entry, longDayLabel } from '../lib/entry'
import { EntryItem } from './EntryItem'

export function DayView({ day, setDay, entries, focusId, onTag, backQuery, onBack }: {
  day: string
  setDay: (d: string) => void
  entries: Entry[]
  focusId: string | null
  onTag: (tag: string) => void
  backQuery: string | null
  onBack: () => void
}) {
  const list = useMemo(
    () => entries.filter((e) => e.day === day).sort((a, b) => b.createdAt - a.createdAt),
    [entries, day],
  )
  const today = dayKey(Date.now())

  useEffect(() => {
    if (focusId) document.getElementById(`entry-${focusId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusId, day])

  return (
    <section className="day">
      {backQuery !== null && (
        <button type="button" className="link back" onClick={onBack}>← Back to results for “{backQuery}”</button>
      )}
      <div className="day-nav">
        <button type="button" onClick={() => setDay(addDays(day, -1))} aria-label="Previous day" title="Previous day (←)">‹</button>
        <h2>{longDayLabel(day)}</h2>
        <button type="button" onClick={() => setDay(addDays(day, 1))} aria-label="Next day" title="Next day (→)">›</button>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Pick a date" />
        {day !== today && <button type="button" onClick={() => setDay(today)} title="Today (t)">Today</button>}
        <span className="muted count">{list.length} {list.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      {list.length === 0 ? (
        <p className="empty">{day === today ? 'Nothing logged yet today. Write your first note above.' : 'No entries on this day.'}</p>
      ) : (
        <div className="timeline">
          {list.map((e, i) => (
            <EntryItem
              key={e.id}
              entry={e}
              gapMinutes={list[i + 1] ? (e.createdAt - list[i + 1].createdAt) / 60000 : null}
              highlighted={e.id === focusId}
              onTag={onTag}
            />
          ))}
        </div>
      )}
    </section>
  )
}
