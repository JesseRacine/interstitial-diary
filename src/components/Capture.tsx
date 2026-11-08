import { useEffect, useRef, useState } from 'react'
import { addEntry } from '../lib/db'
import { timeLabel } from '../lib/entry'
import type { TagStat } from '../search/engine'
import { Suggestions, useTagAutocomplete } from './text'

function useClock() {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function Capture({ tagStats, onSaved, inputRef }: {
  tagStats: TagStat[]
  onSaved: () => void
  inputRef: React.RefObject<HTMLTextAreaElement | null>
}) {
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const now = useClock()
  const ac = useTagAutocomplete(text, caret, tagStats)

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

  const save = async () => {
    if (!text.trim()) return
    await addEntry(text)
    setText('')
    setCaret(0)
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

  const rows = Math.min(8, Math.max(2, text.split('\n').length))

  return (
    <form className="capture" onSubmit={(e) => { e.preventDefault(); void save() }}>
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
        />
        <Suggestions items={ac.suggestions} index={ac.index} onPick={pick} />
      </div>
      <div className="capture-actions">
        <button type="submit" className="primary" disabled={!text.trim()}>Save</button>
      </div>
    </form>
  )
}
