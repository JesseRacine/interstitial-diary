import { useEffect, useMemo, useRef, useState } from 'react'
import { addEntry } from '../lib/db'
import { enterAction, hasCoarsePointer } from '../lib/dom'
import { extractTags, timeLabel } from '../lib/entry'
import type { EventStat } from '../lib/events'
import { useAutoGrow, useCoarsePointer } from '../lib/hooks'
import { noteTargetSuggestions, resolveNoteTarget } from '../lib/noteTarget'
import { canHaveNotes, noteText } from '../lib/notes'
import { displayName, tagKindOf, tagLabel, tagToken } from '../lib/tagKinds'
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

type Mode = 'entry' | 'track' | 'note'

export function Capture({ tagStats, events, onSaved, onOpenNotes, inputRef, initialText = '', onPrefilled }: {
  tagStats: TagStat[]
  /** The journal's events, for suggesting titles already used while `!"` is typed. */
  events?: readonly EventStat[]
  onSaved: () => void
  /** Open the page of a person or place (the "Open" link after saving a note). */
  onOpenNotes?: (key: string) => void
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
  const ac = useTagAutocomplete(text, caret, tagStats, events)
  // Track mode: the box writes a tracked item (a name, a note, one photo; see lib/tracking.ts) instead of a plain entry.
  // Note mode: the box writes a note on a person or place (a fact with no day, text only; see lib/notes.ts).
  const [mode, setMode] = useState<Mode>('entry')
  const track = mode === 'track'
  const noting = mode === 'note'
  const [name, setName] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)
  const draft = useDraftImages([], track ? 1 : undefined)
  const focus = () => inputRef.current?.focus()
  const input = useImageInput(draft, focus)
  useEffect(() => { if (track) nameRef.current?.focus() }, [track])
  const parsedName = parseTrackingTitle(name)
  const nameError = track && name.trim() && 'error' in parsedName ? parsedName.error : null
  const tooManyPhotos = draft.images.length > 1 // a tracked item keeps one photo: remove the extras before tracking

  // The Note form's "Note about" field (lib/noteTarget.ts).
  const [who, setWho] = useState('')
  const [whoPicked, setWhoPicked] = useState(false) // a suggestion was just taken: hide the list until the field changes
  const [whoSel, setWhoSel] = useState(0)
  const whoRef = useRef<HTMLInputElement>(null)
  const known = useMemo(() => tagStats.filter((t) => canHaveNotes(t.tag)).map((t) => t.tag), [tagStats])
  const target = noting ? resolveNoteTarget(who, known) : null
  const whoKeys = noting && !whoPicked ? noteTargetSuggestions(who, tagStats) : []
  const whoItems = whoKeys.map((k) => tagStats.find((t) => t.tag === k)!).filter(Boolean)
  const whoIndex = Math.min(whoSel, Math.max(0, whoItems.length - 1))
  const [savedNote, setSavedNote] = useState<string | null>(null) // the person or place of the note just saved

  const startNote = () => {
    // A single person or place already in the box is most likely who the note is about.
    const named = extractTags(text).filter(canHaveNotes)
    const prefill = named.length === 1 ? tagToken(named[0]) : ''
    setWho(prefill)
    setWhoPicked(!!prefill)
    setWhoSel(0)
    setSavedNote(null)
    setMode('note')
    setTimeout(() => (prefill ? focus() : whoRef.current?.focus()))
  }
  const pickWho = (key: string) => {
    setWho(tagToken(key))
    setWhoPicked(true)
    focus()
  }
  const leaveMode = () => { setMode('entry'); focus() }

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
  // A note needs who or where it is about, and the fact.
  const noteKey = target && 'key' in target ? target.key : null
  const canSave = (track ? !('error' in parsedName) : noting ? !!noteKey && !!text.trim() : !!text.trim()) && !draft.busy

  const save = async () => {
    if (!canSave) return
    if (track && !('error' in parsedName)) {
      await addEntry(trackingEntryText(parsedName.title, text), draft.refs.slice(0, 1))
      setMode('entry')
      setName('')
    } else if (noting && noteKey) {
      await addEntry(noteText(noteKey, text)) // text only: the Note button is off while photos are attached
      setMode('entry')
      setWho('')
      setSavedNote(noteKey) // the journal shows nothing new, so say where it went
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

  useAutoGrow(inputRef, text) // grows with wrapped lines too; capped in index.css (.capture textarea)

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
              if (e.key === 'Escape') leaveMode()
            }}
          />
          <button type="button" className="ghost" onClick={leaveMode} aria-label="Stop tracking this one" title="Back to a plain entry">×</button>
          {nameError && <span className="error">{nameError}</span>}
        </div>
      )}
      {noting && (
        <div className="track-name note-who">
          <label htmlFor="note-who-input">📝 Note about</label>
          <div className="field who-field">
            <input
              id="note-who-input"
              ref={whoRef}
              type="text"
              value={who}
              placeholder="A person or a place"
              maxLength={200}
              autoComplete="off"
              aria-invalid={!!target && 'error' in target}
              onChange={(e) => { setWho(e.target.value); setWhoPicked(false); setWhoSel(0) }}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return
                if (e.key === 'ArrowDown' && whoItems.length) { e.preventDefault(); setWhoSel((whoIndex + 1) % whoItems.length) }
                else if (e.key === 'ArrowUp' && whoItems.length) { e.preventDefault(); setWhoSel((whoIndex - 1 + whoItems.length) % whoItems.length) }
                else if (e.key === 'Enter' || e.key === 'Tab') {
                  if (whoItems.length) { e.preventDefault(); pickWho(whoItems[whoIndex].tag) }
                  else if (e.key === 'Enter') { e.preventDefault(); focus() }
                } else if (e.key === 'Escape') leaveMode()
              }}
            />
            <Suggestions items={whoItems} index={whoIndex} onPick={pickWho} />
          </div>
          <button type="button" className="ghost" onClick={leaveMode} aria-label="Stop writing a note" title="Back to a plain entry">×</button>
          {target && 'error' in target && <span className="error">{target.error}</span>}
          {noteKey && target && 'isNew' in target && target.isNew && (
            <span className="muted small hint">
              New {tagKindOf(noteKey).label.toLowerCase()}: {displayName(noteKey)}
              {tagKindOf(noteKey).id === 'person' ? ' · type ~ in front for a place' : ''}
            </span>
          )}
        </div>
      )}
      <div className="field">
        <textarea
          ref={inputRef}
          value={text}
          rows={1}
          autoFocus
          placeholder={track ? 'Note (optional): price, where, why…' : noting ? 'The fact, e.g. allergic to shellfish' : "What did you just finish? How do you feel? What's next?"}
          aria-label={track ? 'Note for the tracked item' : noting ? 'Note text' : 'New entry'}
          onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionStart); setSavedNote(null) }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
          onKeyDown={onKeyDown}
          onPaste={input.onPaste}
        />
        <Suggestions items={ac.suggestions} index={ac.index} onPick={pick} />
      </div>

      <DraftChips draft={draft} />
      {input.dragging && <p className="capture-notice drop-hint">Drop photos to attach them</p>}
      {savedNote && (
        <p className="capture-notice note-saved" role="status">
          Saved as a note for {tagLabel(savedNote)}
          {onOpenNotes && <> · <button type="button" className="link" onClick={() => { const k = savedNote; setSavedNote(null); onOpenNotes(k) }}>Open</button></>}
          {' '}<button type="button" className="ghost" aria-label="Hide" onClick={() => setSavedNote(null)}>×</button>
        </p>
      )}

      <div className="capture-actions">
        {!noting && <AttachButton draft={draft} onPicked={focus} />}
        <button type="button" className={`ghost track-toggle${track ? ' on' : ''}`} aria-pressed={track} disabled={!track && tooManyPhotos}
          title={!track && tooManyPhotos ? 'A tracked item keeps one photo: remove the extra photos first' : 'Keep an eye on something: a name, a note and one photo'}
          onClick={() => (track ? leaveMode() : setMode('track'))}>
          <span aria-hidden="true">📌</span> <span>Track</span>
        </button>
        <button type="button" className={`ghost note-toggle${noting ? ' on' : ''}`} aria-pressed={noting} disabled={!noting && draft.images.length > 0}
          title={!noting && draft.images.length > 0 ? 'A note is text only: remove the photos first' : 'A fact about a person or place, not tied to a day'}
          onClick={() => (noting ? leaveMode() : startNote())}>
          <span aria-hidden="true">📝</span> <span>Note</span>
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
