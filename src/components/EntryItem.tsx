import { useState } from 'react'
import { deleteEntry, updateEntry } from '../lib/db'
import { type Entry, entryImages, formatGap, shortDayLabel, timeLabel } from '../lib/entry'
import { AttachButton, DraftChips } from './DraftImages'
import { EntryImages } from './EntryImages'
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
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.text)
  const photos = useDraftImages(entryImages(entry))
  const input = useImageInput(photos)
  const images = entryImages(entry)

  const startEdit = () => {
    setDraft(entry.text)
    photos.reset(images)
    setEditing(true)
  }
  const save = async () => {
    if (photos.busy || !draft.trim()) return
    await updateEntry(entry.id, draft, photos.refs)
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
          <div className="row">
            <button type="button" className="primary" onClick={save} disabled={photos.busy || !draft.trim()}>Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <AttachButton draft={photos} />
            <span className="muted">{photos.busy ? 'Preparing photos…' : 'Ctrl+Enter to save · Esc to cancel'}</span>
          </div>
        </div>
      ) : (
        <>
          <EntryText text={entry.text} terms={terms} onTag={onTag} />
          <EntryImages images={images} onOpen={onOpenImage ? (i) => onOpenImage(entry, i) : undefined} />
        </>
      )}
      {bubble && meta}
    </article>
  )
}
