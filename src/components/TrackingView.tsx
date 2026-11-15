import { useMemo, useState } from 'react'
import { deleteEntry, setTracking } from '../lib/db'
import { type Entry, shortDayLabel } from '../lib/entry'
import { TRACKING_ICONS, type TrackingItem, type TrackingSort, splitTracking } from '../lib/tracking'
import { EntryItem } from './EntryItem'
import { useOpenEvent } from './eventNav'
import { EntryText } from './text'
import { Thumb } from './Thumb'

type Show = 'active' | 'done' | 'all'
const SHOWS: [Show, string][] = [['active', 'Active'], ['done', 'Done'], ['all', 'All']]
const SORTS: [TrackingSort, string][] = [['newest', 'Newest'], ['oldest', 'Oldest'], ['name', 'A–Z']]

const remove = async (item: TrackingItem) => {
  if (confirm(`Delete "${item.title}"? It leaves your journal too. You can restore it from Settings > Deleted entries.`)) await deleteEntry(item.id)
}

/** The buttons that change an item: Star / Unstar and Done for one being watched, Track again for a done one. */
function ItemActions({ item, onDeleted }: { item: TrackingItem; onDeleted?: () => void }) {
  return (
    <div className="track-actions">
      {item.state === 'done' ? (
        <button type="button" onClick={() => void setTracking(item.id, 'active')}>Track again</button>
      ) : (
        <>
          <button type="button" aria-pressed={item.state === 'starred'} className={item.state === 'starred' ? 'on' : ''}
            onClick={() => void setTracking(item.id, item.state === 'starred' ? 'active' : 'starred')}>
            {item.state === 'starred' ? '★ Unstar' : '☆ Star'}
          </button>
          <button type="button" onClick={() => void setTracking(item.id, 'done')}>✓ Done</button>
        </>
      )}
      <button type="button" className="ghost danger" onClick={async () => { await remove(item); onDeleted?.() }}>Delete</button>
    </div>
  )
}

const whenLabel = (item: TrackingItem): string =>
  item.state === 'done' ? (item.doneDate ? `Done ${shortDayLabel(item.doneDate)}` : 'Done') : `Added ${shortDayLabel(item.day)}`

function Card({ item, entry, onOpen, onTag, onOpenImage }: {
  item: TrackingItem
  entry: Entry | undefined
  onOpen: (id: string) => void
  onTag: (tag: string) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const openEvent = useOpenEvent()
  return (
    <article className={`track-card ${item.state}`}>
      {item.image && (
        <button type="button" className="entry-image track-photo" aria-label={`Open the photo of ${item.title}`}
          onClick={() => entry && onOpenImage(entry, 0)}>
          <Thumb image={item.image} />
        </button>
      )}
      <div className="track-body">
        <button type="button" className="track-title" onClick={() => onOpen(item.id)} title="Open this item">
          <span aria-hidden="true">{TRACKING_ICONS[item.state]}</span> {item.title}
        </button>
        {item.note && (
          <div className="track-note">
            <EntryText text={item.note} onTag={onTag} onEvent={openEvent && entry ? (title, date) => openEvent(entry, title, date) : undefined} />
          </div>
        )}
        <div className="track-meta muted">{whenLabel(item)}</div>
        <ItemActions item={item} />
      </div>
    </article>
  )
}

/** One item opened: its buttons, and its entry as it is in the journal (full text, every photo, Edit, Delete). */
function ItemPage({ item, entry, onBack, onTag, onOpenDay, onOpenImage }: {
  item: TrackingItem | undefined // undefined once it is gone (deleted, or its marker edited away, while open)
  entry: Entry | undefined
  onBack: () => void
  onTag: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  return (
    <section className="track-page">
      <button type="button" className="ghost back" onClick={onBack}>← Tracking</button>
      {item && entry ? (
        <>
          <h2><span aria-hidden="true">{TRACKING_ICONS[item.state]}</span> {item.title}</h2>
          <p className="summary muted">{whenLabel(item)}</p>
          <ItemActions item={item} onDeleted={onBack} />
          <div className="timeline">
            <EntryItem key={entry.id} entry={entry} showDate onTag={onTag} onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
          </div>
        </>
      ) : (
        <p className="empty">This item is not being tracked any more.</p>
      )}
    </section>
  )
}

/**
 * The Tracking page: things to keep an eye on (see lib/tracking.ts), as cards. Active shows what is still being watched,
 * starred first; Done what is finished; All both. Newest first unless another order is picked. Star, Done, Track again and
 * Delete are on each card; the name opens the item with its entry (Edit, every photo).
 */
export function TrackingView({ entries, items, onTag, onOpenDay, onOpenImage }: {
  entries: Entry[]
  items: TrackingItem[]
  onTag: (tag: string) => void
  onOpenDay: (e: Entry) => void
  onOpenImage: (e: Entry, index: number) => void
}) {
  const [show, setShow] = useState<Show>('active')
  const [sort, setSort] = useState<TrackingSort>('newest')
  const [openId, setOpenId] = useState<string | null>(null)

  const { active, done } = useMemo(() => splitTracking(items, sort), [items, sort])
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries])

  if (openId !== null) {
    return (
      <ItemPage item={items.find((i) => i.id === openId)} entry={byId.get(openId)} onBack={() => setOpenId(null)} onTag={onTag}
        onOpenDay={onOpenDay} onOpenImage={onOpenImage} />
    )
  }

  const counts: Record<Show, number> = { active: active.length, done: done.length, all: items.length }
  const card = (i: TrackingItem) => <Card key={i.id} item={i} entry={byId.get(i.id)} onOpen={setOpenId} onTag={onTag} onOpenImage={onOpenImage} />

  return (
    <section className="tracking">
      <div className="day-nav">
        <div className="seg" role="group" aria-label="Show">
          {SHOWS.map(([k, label]) => (
            <button key={k} type="button" className={show === k ? 'on' : ''} aria-pressed={show === k} onClick={() => setShow(k)}>
              {label} {counts[k]}
            </button>
          ))}
        </div>
        <div className="seg" role="group" aria-label="Sort">
          {SORTS.map(([k, label]) => (
            <button key={k} type="button" className={sort === k ? 'on' : ''} aria-pressed={sort === k} onClick={() => setSort(k)}>{label}</button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="empty">
          Nothing tracked yet. Write an entry that starts a name with a plus, like <code>+&quot;Dyson V15&quot; $450 on Amazon</code>, and it
          appears here. A photo in the entry shows on its card.
        </p>
      ) : show === 'active' ? (
        active.length ? active.map(card) : <p className="empty">Nothing is being tracked right now. Finished items are under Done.</p>
      ) : show === 'done' ? (
        done.length ? done.map(card) : <p className="empty">Nothing is marked done yet.</p>
      ) : (
        <>
          {active.length > 0 && <div className="track-group">{done.length > 0 && <h3>Active</h3>}{active.map(card)}</div>}
          {done.length > 0 && <div className="track-group"><h3>Done</h3>{done.map(card)}</div>}
        </>
      )}
    </section>
  )
}
