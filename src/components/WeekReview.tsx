import { shortDayLabel } from '../lib/entry'
import { EVENT_ICON } from '../lib/events'
import { eventDateLabel } from '../lib/eventRows'
import { tagLabel } from '../lib/tagKinds'
import { type WeekReview as Review, compareLabel } from '../lib/weekReview'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * One week at a glance: how much was written, when, and about whom and what. One colour for the bars (the same green ramp
 * as the calendar); the busiest day is the darker step and the only one with a number on it, the rest say their count
 * on hover or focus and to a screen reader. Bars are sized from the counts, so nothing moves while it loads.
 */
export function WeekReview({ review: r, onOpenDay, onTag, onOpenEvent }: {
  review: Review
  onOpenDay: (day: string) => void
  onTag: (tag: string) => void
  onOpenEvent: (id: string) => void
}) {
  if (r.total === 0) {
    return <p className="empty">No entries this week{r.previousTotal ? `. The week before had ${r.previousTotal}.` : '.'}</p>
  }
  const max = Math.max(...r.days.map((d) => d.count))
  const bandMax = Math.max(...r.bands.map((b) => b.count))
  const compare = compareLabel(r.total, r.previousTotal)

  return (
    <div className="week-review">
      <dl className="week-stats">
        <div><dt>Entries</dt><dd>{r.total}</dd><span className="muted">{compare}</span></div>
        <div><dt>Days written</dt><dd>{r.activeDays}<span className="muted"> of 7</span></dd></div>
        <div><dt>Photos</dt><dd>{r.photos}</dd></div>
        <div>
          <dt>Busiest day</dt>
          <dd>{r.busiest ? DOW[r.days.findIndex((d) => d.day === r.busiest!.day)] : '–'}</dd>
          {r.busiest && <span className="muted">{plural(r.busiest.count, 'entry', 'entries')}</span>}
        </div>
      </dl>

      <section aria-label="Entries per day">
        <h3>Per day</h3>
        <div className="week-bars">
          {r.days.map((d, i) => {
            const busiest = d.day === r.busiest?.day
            return (
              <button key={d.day} type="button" className={`week-bar${busiest ? ' top' : ''}`}
                style={{ '--h': d.count ? `${Math.max(6, Math.round((d.count / max) * 100))}%` : '0%' } as React.CSSProperties}
                onClick={() => onOpenDay(d.day)}
                title={`${shortDayLabel(d.day)}: ${plural(d.count, 'entry', 'entries')}`}
                aria-label={`${shortDayLabel(d.day)}: ${plural(d.count, 'entry', 'entries')}. Open this day`}>
                <span className="num">{busiest ? d.count : ''}</span>
                <span className="track"><span className="fill" /></span>
                <span className="dow">{DOW[i]}<span className="muted"> {Number(d.day.slice(8))}</span></span>
              </button>
            )
          })}
        </div>
      </section>

      <section aria-label="Time of day">
        <h3>Time of day</h3>
        <ul className="week-bands">
          {r.bands.map((b) => (
            <li key={b.id} title={`${b.label} ${b.hours} h: ${plural(b.count, 'entry', 'entries')}`}>
              <span className="label">{b.label} <span className="muted">{b.hours}</span></span>
              <span className="track"><span className="fill" style={{ width: bandMax ? `${(b.count / bandMax) * 100}%` : '0%' }} /></span>
              <span className="count">{b.count}</span>
            </li>
          ))}
        </ul>
      </section>

      {r.top.map(({ kind, items }) => (
        <section key={kind.id} aria-label={`Top ${kind.plural.toLowerCase()}`}>
          <h3>{kind.plural}</h3>
          <div className="week-chips">
            {items.map(({ tag, count }) => (
              <button key={tag} type="button" className={kind.className} onClick={() => onTag(tag)} title="Search for this">
                {tagLabel(tag)} <span className="muted">{count}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {r.events.length > 0 && (
        <section aria-label="Events">
          <h3>Events</h3>
          <ul className="week-events">
            {r.events.map((ev) => (
              <li key={ev.id}>
                <button type="button" className="link" onClick={() => onOpenEvent(ev.id)}>{EVENT_ICON} {ev.title}</button>
                <span className="muted"> {eventDateLabel(ev.first, ev.last)} · {plural(ev.count, 'entry', 'entries')} this week</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
