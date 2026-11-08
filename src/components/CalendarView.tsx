import { useMemo, useState } from 'react'
import { dayKey, type Entry, MONTH_NAMES, pad } from '../lib/entry'
import { countByDay } from '../search/engine'

const WEEK_HEAD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
  const lead = (first.getDay() + 6) % 7 // Monday-first
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

export function CalendarView({ entries, onOpenDay }: { entries: Entry[]; onOpenDay: (day: string) => void }) {
  const counts = useMemo(() => countByDay(entries), [entries])
  const now = new Date()
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const [y, setY] = useState(now.getFullYear())
  const [m, setM] = useState(now.getMonth())
  const today = dayKey(now)

  const prefix = mode === 'month' ? `${y}-${pad(m + 1)}` : `${y}`
  let max = 0
  let total = 0
  let activeDays = 0
  for (const [k, c] of counts) if (k.startsWith(prefix)) { max = Math.max(max, c); total += c; activeDays++ }

  const step = (dir: number) => {
    if (mode === 'year') return setY(y + dir)
    const d = new Date(y, m + dir, 1)
    setY(d.getFullYear())
    setM(d.getMonth())
  }

  return (
    <section className="calendar">
      <div className="day-nav">
        <button type="button" onClick={() => step(-1)} aria-label="Previous">‹</button>
        <h2>{mode === 'month' ? `${MONTH_NAMES[m]} ${y}` : y}</h2>
        <button type="button" onClick={() => step(1)} aria-label="Next">›</button>
        <div className="seg">
          <button type="button" className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>Month</button>
          <button type="button" className={mode === 'year' ? 'on' : ''} onClick={() => setMode('year')}>Year</button>
        </div>
        <span className="muted count">{total} entries · {activeDays} days</span>
      </div>
      {mode === 'month' ? (
        <Month y={y} m={m} counts={counts} max={max} today={today} onOpenDay={onOpenDay} />
      ) : (
        <div className="year">
          {MONTH_NAMES.map((_, i) => (
            <Month key={i} y={y} m={i} counts={counts} max={max} compact today={today} onOpenDay={onOpenDay} />
          ))}
        </div>
      )}
      <div className="legend muted">
        Fewer {[0, 1, 2, 3, 4].map((l) => <span key={l} className={`cell heat-${l}`} />)} More
      </div>
    </section>
  )
}
