import { useEffect, useRef, useState } from 'react'
import { addEntry } from '../lib/db'
import { enterAction, hasCoarsePointer } from '../lib/dom'
import { timeLabel } from '../lib/entry'
import { useCoarsePointer } from '../lib/hooks'
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
  const draft = useDraftImages()
  const focus = () => inputRef.current?.focus()
  const input = useImageInput(draft, focus)

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

  // Text is required, even with photos; wait until every photo is stored.
  const canSave = !!text.trim() && !draft.busy

  const save = async () => {
    if (!canSave) return
    await addEntry(text, draft.refs)
    setText('')
    setCaret(0)
    draft.reset()
    onSaved()
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
          {' '}· # tags · @ people · ~ places · !"event"
        </span>
      </div>
      <div className="field">
        <textarea
          ref={inputRef}
          value={text}
          rows={rows}
          autoFocus
          placeholder="What did you just finish? How do you feel? What's next?"
          aria-label="New entry"
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
        <span className="spacer" />
        {draft.busy && <span className="muted small">Preparing photos…</span>}
        <button type="submit" className="primary" disabled={!canSave} title={!text.trim() && draft.images.length ? 'Write a few words to save the photos with' : undefined}>
          Save
        </button>
      </div>
    </form>
  )
}
