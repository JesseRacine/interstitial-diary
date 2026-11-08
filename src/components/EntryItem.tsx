import { useState } from 'react'
import { deleteEntry, updateEntryText } from '../lib/db'
import { type Entry, formatGap, shortDayLabel, timeLabel } from '../lib/entry'
import { EntryText } from './text'

export function EntryItem({ entry, gapMinutes, showDate, terms, highlighted, onTag, onOpenDay }: {
  entry: Entry
  gapMinutes?: number | null
  showDate?: boolean
  terms?: string[]
  highlighted?: boolean
  onTag: (tag: string) => void
  onOpenDay?: (e: Entry) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry.text)

  const save = async () => {
    if (draft.trim() && draft.trim() !== entry.text) await updateEntryText(entry.id, draft)
    setEditing(false)
  }
  const remove = async () => {
    if (confirm('Delete this entry?')) await deleteEntry(entry.id)
  }

  return (
    <article id={`entry-${entry.id}`} className={`entry${highlighted ? ' flash' : ''}`}>
      <header className="entry-meta">
        {showDate && (
          <button type="button" className="link" onClick={() => onOpenDay?.(entry)} title="Open this day">
            {shortDayLabel(entry.day)}
          </button>
        )}
        <span className="time">{timeLabel(entry.createdAt)}</span>
        {gapMinutes != null && <span className="gap">{formatGap(gapMinutes)}</span>}
        <span className="spacer" />
        {!editing && (
          <span className="entry-actions">
            <button type="button" className="ghost" onClick={() => { setDraft(entry.text); setEditing(true) }}>Edit</button>
            <button type="button" className="ghost danger" onClick={remove}>Delete</button>
          </span>
        )}
      </header>
      {editing ? (
        <div className="edit">
          <textarea
            value={draft}
            autoFocus
            rows={Math.max(2, draft.split('\n').length)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
              if (e.key === 'Escape') setEditing(false)
            }}
          />
          <div className="row">
            <button type="button" className="primary" onClick={save}>Save</button>
            <button type="button" onClick={() => setEditing(false)}>Cancel</button>
            <span className="muted">Ctrl+Enter to save · Esc to cancel</span>
          </div>
        </div>
      ) : (
        <EntryText text={entry.text} terms={terms} onTag={onTag} />
      )}
    </article>
  )
}
