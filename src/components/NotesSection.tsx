import { useState } from 'react'
import { addEntry, deleteEntry, updateEntryText } from '../lib/db'
import { confirmDialog } from '../lib/dialog'
import { useCoarsePointer } from '../lib/hooks'
import { type Note, noteText } from '../lib/notes'
import { displayName } from '../lib/tagKinds'
import { EntryImages } from './EntryImages'
import { EntryText } from './text'

/**
 * The Notes at the top of a person's or place's page (see lib/notes.ts): facts that do not belong to a day, newest first,
 * with no date. Each note is an ordinary entry written `=@sam_jones fact`; this section only ever shows and edits the fact,
 * and writes the marker itself. Add note, Edit and Delete are ordinary entry changes, so they sync like any other.
 */
export function NotesSection({ tag, notes, onTag, onOpenImage }: {
  tag: string // stored key, `@sam_jones` or `~blue_door`
  notes: Note[]
  onTag: (key: string) => void
  onOpenImage?: (entryId: string, index: number) => void
}) {
  const [adding, setAdding] = useState(false)
  const name = displayName(tag)

  return (
    <section className="notes" aria-label={`Notes about ${name}`}>
      <div className="notes-head">
        <h3>Notes</h3>
        {!adding && <button type="button" onClick={() => setAdding(true)}>+ Add note</button>}
      </div>
      {adding && (
        <NoteEditor initial="" label={`New note about ${name}`} saveLabel="Save note"
          onSave={async (text) => { await addEntry(noteText(tag, text)); setAdding(false) }}
          onCancel={() => setAdding(false)} />
      )}
      {notes.length === 0 && !adding ? (
        <p className="muted notes-empty">No notes yet. A note is a fact about {name} that does not belong to a day.</p>
      ) : (
        <ul className="note-list">
          {notes.map((n) => <NoteItem key={n.id} note={n} onTag={onTag} onOpenImage={onOpenImage} />)}
        </ul>
      )}
    </section>
  )
}

function NoteItem({ note, onTag, onOpenImage }: { note: Note; onTag: (key: string) => void; onOpenImage?: (entryId: string, index: number) => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) {
    return (
      <li className="note-item editing">
        <NoteEditor initial={note.note} label="Edit note" saveLabel="Save"
          onSave={async (text) => { await updateEntryText(note.id, noteText(note.key, text)); setEditing(false) }}
          onCancel={() => setEditing(false)} />
      </li>
    )
  }
  return (
    <li className="note-item">
      <div className="note-body">
        {note.note ? <EntryText text={note.note} onTag={onTag} /> : <span className="muted">(empty note)</span>}
        {note.images && <EntryImages images={note.images} onOpen={onOpenImage ? (i) => onOpenImage(note.id, i) : undefined} />}
      </div>
      <span className="entry-actions">
        <button type="button" className="ghost" onClick={() => setEditing(true)}>Edit</button>
        <button type="button" className="ghost danger" onClick={async () => { if (await confirmDialog('Delete this note?', { confirmLabel: 'Delete', danger: true })) await deleteEntry(note.id) }}>Delete</button>
      </span>
    </li>
  )
}

/** The text box for a new or edited note. Saving needs some text; Esc cancels; Ctrl+Enter saves (Enter is a new line). */
function NoteEditor({ initial, label, saveLabel, onSave, onCancel }: {
  initial: string
  label: string
  saveLabel: string
  onSave: (text: string) => Promise<void>
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const [busy, setBusy] = useState(false)
  const coarse = useCoarsePointer()
  const canSave = !busy && !!text.trim()
  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try { await onSave(text) } finally { setBusy(false) }
  }
  return (
    <div className="note-editor">
      <textarea value={text} autoFocus autoComplete="off" aria-label={label}placeholder="For example: allergic to shellfish" rows={Math.max(2, text.split('\n').length)}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save()
          if (e.key === 'Escape') onCancel()
        }} />
      <div className="row">
        <button type="button" className="primary" onClick={save} disabled={!canSave}>{saveLabel}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
        {!coarse && <span className="muted small">Ctrl+Enter to save · Esc to cancel</span>}
      </div>
    </div>
  )
}
