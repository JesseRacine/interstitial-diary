import { useEffect, useRef, useState } from 'react'
import { addEntry } from '../lib/db'
import { timeLabel } from '../lib/entry'
import { MAX_IMAGES_PER_ENTRY } from '../lib/images'
import type { TagStat } from '../search/engine'
import { Suggestions, useTagAutocomplete } from './text'
import { useDraftImages } from './useDraftImages'

function useClock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const hasFiles = (dt: DataTransfer | null) => !!dt && [...dt.types].includes('Files')

export function Capture({ tagStats, onSaved, inputRef }: {
  tagStats: TagStat[]
  onSaved: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [dragging, setDragging] = useState(false)
  const now = useClock()
  const ac = useTagAutocomplete(text, caret, tagStats)
  const draft = useDraftImages()
  const fileInput = useRef<HTMLInputElement>(null)

  const pending = useRef<number | null>(null)
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
    draft.clear()
    onSaved()
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const tag = ac.onKey(e)
    if (tag) return pick(tag)
    if (e.defaultPrevented) return
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void save()
    }
  }

  // Paste is only taken over when the clipboard holds files (e.g. a screenshot); text pastes as usual.
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = [...e.clipboardData.files]
    if (!files.length) return
    e.preventDefault()
    void draft.add(files)
  }

  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
  }
  const onDrop = (e: React.DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return
    e.preventDefault()
    setDragging(false)
    void draft.add([...e.dataTransfer.files])
    inputRef.current?.focus()
  }

  const rows = Math.min(8, Math.max(1, text.split('\n').length))
  const full = draft.images.length >= MAX_IMAGES_PER_ENTRY

  return (
    <form
      className={`capture${dragging ? ' dragging' : ''}`}
      onSubmit={(e) => { e.preventDefault(); void save() }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="capture-head">
        <span className="time">{timeLabel(now)}</span>
        <span className="muted">Enter to save · Shift+Enter for a new line · # for tags</span>
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
          onPaste={onPaste}
        />
        <Suggestions items={ac.suggestions} index={ac.index} onPick={pick} />
      </div>

      {draft.images.length > 0 && (
        <ul className="draft-images" aria-label="Attached photos">
          {draft.images.map((img) => (
            <li key={img.key} className={img.status}>
              {img.url
                ? <img src={img.url} alt="" decoding="async" />
                : <span className="placeholder">{img.status === 'working' ? '…' : (img.ref?.ext.toUpperCase() ?? '?')}</span>}
              <button type="button" className="remove" aria-label={`Remove ${img.name}`} title="Remove" onClick={() => draft.remove(img.key)}>×</button>
            </li>
          ))}
        </ul>
      )}
      {draft.notice && <p className="capture-notice" role="status">{draft.notice}</p>}
      {dragging && <p className="capture-notice drop-hint">Drop photos to attach them</p>}

      <div className="capture-actions">
        <button
          type="button"
          className="ghost attach"
          onClick={() => fileInput.current?.click()}
          disabled={full}
          title={full ? `Up to ${MAX_IMAGES_PER_ENTRY} photos per entry` : 'Attach photos (or paste / drop them)'}
          aria-label="Attach photos"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m21 16-5-5-8 8" />
          </svg>
          <span>Photo</span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void draft.add([...(e.target.files ?? [])])
            e.target.value = '' // so picking the same file again still fires
            inputRef.current?.focus()
          }}
        />
        <span className="spacer" />
        {draft.busy && <span className="muted small">Preparing photos…</span>}
        <button type="submit" className="primary" disabled={!canSave} title={!text.trim() && draft.images.length ? 'Write a few words to save the photos with' : undefined}>
          Save
        </button>
      </div>
    </form>
  )
}
