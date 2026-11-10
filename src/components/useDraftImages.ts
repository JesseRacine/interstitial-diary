import { useCallback, useRef, useState } from 'react'
import { type AttachResult, attachImage } from '../lib/attach'
import type { ImageRef } from '../lib/entry'
import { WARN_BYTES_PER_ENTRY, fitImageLimit, formatBytes } from '../lib/images'

/** A photo on an entry draft (a new entry, or one being edited). */
export interface DraftImage {
  key: number
  name: string
  status: 'working' | 'ready'
  ref?: ImageRef
  size: number // bytes; 0 for photos that were already on the entry
}

let nextKey = 1
const fromRefs = (refs: ImageRef[]): DraftImage[] =>
  refs.map((ref, i) => ({ key: nextKey++, name: `Photo ${i + 1}`, status: 'ready', ref, size: 0 }))

/**
 * The photos on a draft. Each new file is saved to the database as soon as it is added (attachImage), so only the
 * references live here; losing the draft never loses a photo. Thumbnails are shown through the shared cache (Thumb).
 */
export function useDraftImages(initial: ImageRef[] = []) {
  const [images, setImages] = useState<DraftImage[]>(() => fromRefs(initial))
  const [notice, setNotice] = useState<string | null>(null)
  // The current list, kept outside React so async attach callbacks never work on a stale copy.
  const list = useRef<DraftImage[]>(images)
  const commit = useCallback((next: DraftImage[]) => {
    list.current = next
    setImages(next)
  }, [])

  const add = useCallback(async (files: File[]) => {
    if (!files.length) return
    const { take, message } = fitImageLimit(list.current.length, files.length)
    const notes: string[] = message ? [message] : []
    const chosen = files.slice(0, take)
    const placeholders: DraftImage[] = chosen.map((f) => ({ key: nextKey++, name: f.name || 'Pasted image', status: 'working', size: f.size }))
    commit([...list.current, ...placeholders])
    if (!chosen.length) return setNotice(notes.join(' '))

    const results = await Promise.all(chosen.map((f) => attachImage(f).catch((e): AttachResult => ({ ok: false, reason: String(e) }))))
    const done = new Map<number, DraftImage | null>()
    results.forEach((r, i) => {
      const p = placeholders[i]
      if (r.ok) done.set(p.key, { ...p, status: 'ready', ref: r.ref, size: r.size })
      else {
        notes.push(`${p.name}: ${r.reason}`)
        done.set(p.key, null)
      }
    })

    const seen = new Set<string>()
    const out: DraftImage[] = []
    const dupes: string[] = []
    for (const img of list.current) { // chips removed while attaching are no longer here, so their results are dropped
      const next = done.has(img.key) ? done.get(img.key) : img
      if (!next) continue
      const hash = next.ref?.hash
      if (hash && seen.has(hash)) { dupes.push(next.name); continue } // the same photo twice: keep the first
      if (hash) seen.add(hash)
      out.push(next)
    }
    if (dupes.length === 1) notes.push(`${dupes[0]} is already attached.`)
    else if (dupes.length) notes.push(`${dupes.length} of these photos were already attached.`)
    const total = out.reduce((n, i) => n + i.size, 0)
    if (total > WARN_BYTES_PER_ENTRY) notes.push(`These photos add up to ${formatBytes(total)}, which is a lot for one entry.`)
    commit(out)
    setNotice(notes.length ? notes.join(' ') : null)
  }, [commit])

  const remove = useCallback((key: number) => {
    commit(list.current.filter((i) => i.key !== key))
    setNotice(null)
  }, [commit])

  /** Start over from these photos (after saving, or when editing starts again). The bytes stay in the database. */
  const reset = useCallback((refs: ImageRef[] = []) => {
    commit(fromRefs(refs))
    setNotice(null)
  }, [commit])

  const busy = images.some((i) => i.status === 'working')
  const refs = images.flatMap((i) => (i.ref ? [i.ref] : []))
  return { images, refs, busy, notice, add, remove, reset }
}

export type DraftImages = ReturnType<typeof useDraftImages>

const hasFiles = (dt: DataTransfer | null) => !!dt && [...dt.types].includes('Files')

/**
 * Paste and drag-and-drop handlers for a draft. Paste is only taken over when the clipboard holds files (e.g. a
 * screenshot); text pastes as usual. `dragging` is true while files hover over the element.
 */
export function useImageInput(draft: DraftImages, afterDrop?: () => void) {
  const [dragging, setDragging] = useState(false)
  const { add } = draft
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    const files = [...e.clipboardData.files]
    if (!files.length) return
    e.preventDefault()
    void add(files)
  }, [add])
  const dropHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragging(true)
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasFiles(e.dataTransfer)) return
      e.preventDefault()
      setDragging(false)
      void add([...e.dataTransfer.files])
      afterDrop?.()
    },
  }
  return { dragging, onPaste, dropHandlers }
}
