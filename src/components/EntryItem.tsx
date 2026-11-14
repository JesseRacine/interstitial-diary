import { useState } from 'react'
import { deleteEntry, updateEntry } from '../lib/db'
import { type Entry, dayKey, entryImages, formatGap, shortDayLabel, timeLabel } from '../lib/entry'
import { fromDateTimeInput, isAllowedTime, retimedCreatedAt, toDateTimeInput } from '../lib/retime'
import { AttachButton, DraftChips } from './DraftImages'
import { EntryImages } from './EntryImages'
import { useOpenEvent } from './eventNav'
import { useCoarsePointer } from '../lib/hooks'
import { EntryText } from './text'
import { useDraftImages, useImageInput } from './useDraftImages'

export function EntryItem({ entry, gapMinutes, showDate, terms, highlighted, bubble, onTag, onOpenDay, onOpenImage }: {
  entry: Entry
  gapMinutes?: number | null
  showDate?: boolean
  terms?: string[]
  highlighted?: boolean
  /** Chat-bubble look: text first, small time and actions underneath. */
  bubble?: boolean
  onTag: (tag: string) => void
  onOpenDay?: (e: Entry) => void
  onOpenImage?: (e: Entry, index: number) => void
}) {
  const openEvent = useOpenEvent()
  const coarse = useCoarsePointer()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.text)
  const photos = useDraftImages(entryImages(entry))
  const input = useImageInput(photos)
  const images = entryImages(entry)

  const [when, setWhen] = useState(() => toDateTimeInput(entry.createdAt))
  const [clock, setClock] = useState(0) // "now" as of the last time the field changed (the time check must not read the clock while rendering)
  const picked = fromDateTimeInput(when)
  const newCreatedAt = retimedCreatedAt(entry.createdAt, picked)
  const whenError = Number.isNaN(picked)
    ? 'Pick a date and a time'
    : newCreatedAt !== entry.createdAt && !isAllowedTime(newCreatedAt, clock)
      ? 'That time is in the future'
      : null
  const movesTo = !whenError && dayKey(newCreatedAt) !== entry.day ? shortDayLabel(dayKey(newCreatedAt)) : null

  const startEdit = () => {
    setDraft(entry.text)
    setWhen(toDateTimeInput(entry.createdAt))
    setClock(Date.now())
    photos.reset(images)
    setEditing(true)
  }
  const canSave = !photos.busy && !!draft.trim() && !whenError
  const save = async () => {
    if (!canSave) return
    await updateEntry(entry.id, draft, photos.refs, picked)
    setEditing(false)
  }
  const remove = async () => {
    if (confirm('Delete this entry?')) await deleteEntry(entry.id)
  }

  const meta = (
    <header className="entry-meta">
      {showDate && (
        <button type="button" className="link" onClick={() => onOpenDay?.(entry)} title="Open this day">
          {shortDayLabel(entry.day)}
        </button>
      )}
      <span className="time">{timeLabel(entry.createdAt)}</span>
      {!bubble && gapMinutes != null && <span className="gap">{formatGap(gapMinutes)}</span>}
      <span className="spacer" />
      {!editing && (
        <span className="entry-actions">
          <button type="button" className="ghost" onClick={startEdit}>Edit</button>
          <button type="button" className="ghost danger" onClick={remove}>Delete</button>
        </span>
      )}
    </header>
  )

  return (
    <article id={`entry-${entry.id}`} className={`entry${bubble ? ' bubble' : ''}${highlighted ? ' flash' : ''}`}>
      {!bubble && meta}
      {editing ? (
        <div className={`edit${input.dragging ? ' dragging' : ''}`} {...input.dropHandlers}>
          <textarea
            value={draft}
            autoFocus
            aria-label="Edit entry"
            rows={Math.max(2, draft.split('\n').length)}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={input.onPaste}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <DraftChips draft={photos} />
          <div className="row when">
            <label htmlFor={`when-${entry.id}`} className="muted">When</label>
            <input id={`when-${entry.id}`} type="datetime-local" value={when} onChange={(e) => { setWhen(e.target.value); setClock(Date.now()) }}
              aria-invalid={!!whenError} />
            {whenError && <span className="error">{whenError}</span>}
            {movesTo && <span className="muted">Moves to {movesTo}</span>}
          </div>
          <div className="row">
            <button type="button" className="primary" onClick={save} disabled={!canSave}>Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <AttachButton draft={photos} />
            <span className="muted">{photos.busy ? 'Preparing photos…' : coarse ? 'Enter for a new line' : 'Ctrl+Enter to save · Esc to cancel'}</span>
          </div>
        </div>
      ) : (
        <>
          <EntryText text={entry.text} terms={terms} onTag={onTag} onEvent={openEvent ? (title, date) => openEvent(entry, title, date) : undefined} />
          <EntryImages images={images} onOpen={onOpenImage ? (i) => onOpenImage(entry, i) : undefined} />
        </>
      )}
      {bubble && meta}
    </article>
  )
}
