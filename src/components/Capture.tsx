import { useEffect, useRef, useState } from 'react'
import { addEntry } from '../lib/db'
import { enterAction, hasCoarsePointer } from '../lib/dom'
import { timeLabel } from '../lib/entry'
import { useCoarsePointer } from '../lib/hooks'
import { parseTrackingTitle, trackingEntryText } from '../lib/tracking'
import type { TagStat } from '../search/engine'
import { AttachButton, DraftChips } from './DraftImages'
import { Suggestions, useTagAutocomplete } from './text'
import { useDraftImages, useImageInput } from './useDraftImages'

function useClock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function Capture({ tagStats, onSaved, inputRef, initialText = '', onPrefilled }: {
  tagStats: TagStat[]
  onSaved: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  /** Text to start with (shared from another app); only read when the box first appears. */
  initialText?: string
  /** Called once the box has taken `initialText`, so the owner can forget it (coming back later starts empty). */
  onPrefilled?: () => void
}) {
  const [text, setText] = useState(initialText)
  const [caret, setCaret] = useState(initialText.length)
  const now = useClock()
  const coarse = useCoarsePointer()
  const ac = useTagAutocomplete(text, caret, tagStats)
  // Track mode: the box writes a tracked item (a name, a note, one photo; see lib/tracking.ts) instead of a plain entry.
  const [track, setTrack] = useState(false)
  const [name, setName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const draft = useDraftImages([], track ? 1 : undefined)
  const focus = () => inputRef.current?.focus()
  const input = useImageInput(draft, focus)
  useEffect(() => { if (track) nameRef.current?.focus() }, [track])
  const parsedName = parseTrackingTitle(name)
  const nameError = track && name.trim() && 'error' in parsedName ? parsedName.error : null
  const tooManyPhotos = draft.images.length > 1 // a tracked item keeps one photo: remove the extras before tracking

  const pending = useRef<number | null>(initialText ? initialText.length : null) // caret at the end of shared text
  useEffect(() => { if (initialText) onPrefilled?.() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pending.current !== null && inputRef.current) {
      inputRef.current.setSelectionRange(pending.current, pending.current)
      pending.current = null
    }
  })

  const pick = (tag: string) => {
    const r = ac.apply(tag)
    setText(r.text)
    setCaret(r.caret)
    pending.current = r.caret
    inputRef.current?.focus()
  }

  // Text is required, even with photos; wait until every photo is stored. A tracked item needs a name; its note is optional.
  const canSave = (track ? !('error' in parsedName) : !!text.trim()) && !draft.busy

  const save = async () => {
    if (!canSave) return
    if (track && !('error' in parsedName)) {
      await addEntry(trackingEntryText(parsedName.title, text), draft.refs.slice(0, 1))
      setTrack(false)
      setName('')
    } else {
      await addEntry(text, draft.refs)
    }
    setText('')
    setCaret(0)
    draft.reset()
    onSaved()
    focus() // stay ready for the next entry (see the Save button's onMouseDown)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const tag = ac.onKey(e)
    if (tag) return pick(tag)
    if (e.defaultPrevented) return
    // A touch screen's keyboard has no Shift+Enter, so there a plain Enter adds a line (see enterAction).
    if (enterAction({ key: e.key, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, isComposing: e.nativeEvent.isComposing }, hasCoarsePointer()) === 'save') {
      e.preventDefault()
      void save()
    }
  }

  const rows = Math.min(8, Math.max(1, text.split('\n').length))

  return (
    <form
      className={`capture${input.dragging ? ' dragging' : ''}`}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      {...input.dropHandlers}
    >
      <div className="capture-head">
        <span className="time">{timeLabel(now)}</span>
        <span className="muted">
          {coarse ? 'Enter for a new line · Save button saves' : 'Enter to save · Shift+Enter for a new line'}
          {' '}· # tags · @ people · ~ places · !"event" · +"item"
        </span>
      </div>
      {track && (
        <div className="track-name">
          <label htmlFor="track-name-input">📌 Track</label>
          <input
            id="track-name-input"
            ref={nameRef}
            type="text"
            value={name}
            placeholder="Name, e.g. Dyson V15 vacuum"
            maxLength={200}
            autoComplete="off"
            aria-invalid={!!nameError}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void save() }
              if (e.key === 'Escape') { setTrack(false); focus() }
            }}
          />
          <button type="button" className="ghost" onClick={() => { setTrack(false); focus() }} aria-label="Stop tracking this one" title="Back to a plain entry">×</button>
          {nameError && <span className="error">{nameError}</span>}
        </div>
      )}
      <div className="field">
        <textarea
          ref={inputRef}
          value={text}
          rows={rows}
          autoFocus
          placeholder={track ? 'Note (optional): price, where, why…' : "What did you just finish? How do you feel? What's next?"}
          aria-label={track ? 'Note for the tracked item' : 'New entry'}
          onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart) }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={input.onPaste}
        />
        <Suggestions items={ac.suggestions} index={ac.index} onPick={pick} />
      </div>

      <DraftChips draft={draft} />
      {input.dragging && <p className="capture-notice drop-hint">Drop photos to attach them</p>}

      <div className="capture-actions">
        <AttachButton draft={draft} onPicked={focus} />
        <button type="button" className={`ghost track-toggle${track ? ' on' : ''}`} aria-pressed={track} disabled={!track && tooManyPhotos}
          title={!track && tooManyPhotos ? 'A tracked item keeps one photo: remove the extra photos first' : 'Keep an eye on something: a name, a note and one photo'}
          onClick={() => setTrack(!track)}>
          <span aria-hidden="true">📌</span> <span>Track</span>
        </button>
        <span className="spacer" />
        {draft.busy && <span className="muted small">Preparing photos…</span>}
        {/* The button must not take the focus: it is disabled right after saving, and a disabled button drops the
            focus, which on a phone closes the keyboard and moves the whole page while you try to tap the box again. */}
        <button type="submit" className="primary" disabled={!canSave} onMouseDown={(e) => e.preventDefault()} title={!text.trim() && draft.images.length ? 'Write a few words to save the photos with' : undefined}>
          Save
        </button>
      </div>
    </form>
  )
}
