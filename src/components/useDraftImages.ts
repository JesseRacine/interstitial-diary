import { useCallback, useEffect, useRef, useState } from 'react'
import { type AttachResult, attachImage } from '../lib/attach'
import { db } from '../lib/db'
import type { ImageRef } from '../lib/entry'
import { WARN_BYTES_PER_ENTRY, fitImageLimit, formatBytes } from '../lib/images'

/** A photo being attached to an entry that hasn't been saved yet. */
export interface DraftImage {
  key: number
  name: string
  status: 'working' | 'ready'
  ref?: ImageRef
  size: number
  url?: string // object URL of the thumbnail, revoked when the chip goes away
}

let nextKey = 1
const revoke = (i: DraftImage) => { if (i.url) URL.revokeObjectURL(i.url) }

/**
 * The photos attached to a draft. Each file is saved to the database as soon as it is added (attachImage), so only the
 * references live here; losing the draft never loses a photo.
 */
export function useDraftImages() {
  const [images, setImages] = useState<DraftImage[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  // The current list, kept outside React so async attach callbacks never work on a stale copy.
  const list = useRef<DraftImage[]>([])
  const commit = useCallback((next: DraftImage[]) => {
    list.current = next
    setImages(next)
  }, [])

  useEffect(() => () => list.current.forEach(revoke), [])

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
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      const p = placeholders[i]
      if (!r.ok) {
        notes.push(`${p.name}: ${r.reason}`)
        done.set(p.key, null)
        continue
      }
      const thumb = await db.thumbs.get(r.ref.hash)
      done.set(p.key, { ...p, status: 'ready', ref: r.ref, size: r.size, url: thumb ? URL.createObjectURL(thumb.blob) : undefined })
    }

    const seen = new Set<string>()
    const out: DraftImage[] = []
    const dupes: string[] = []
    for (const img of list.current) {
      if (!done.has(img.key)) { // not part of this batch (or removed meanwhile)
        if (img.ref) seen.add(img.ref.hash)
        out.push(img)
        continue
      }
      const next = done.get(img.key)
      if (!next) continue
      if (seen.has(next.ref!.hash)) { // the same photo twice in one entry: keep the first
        revoke(next)
        dupes.push(next.name)
        continue
      }
      seen.add(next.ref!.hash)
      out.push(next)
    }
    if (dupes.length === 1) notes.push(`${dupes[0]} is already attached.`)
    else if (dupes.length) notes.push(`${dupes.length} of these photos were already attached.`)
    // Chips removed while attaching: their results are dropped.
    for (const [key, d] of done) if (d && !out.includes(d) && !list.current.some((i) => i.key === key)) revoke(d)

    const total = out.reduce((n, i) => n + i.size, 0)
    if (total > WARN_BYTES_PER_ENTRY) notes.push(`These photos add up to ${formatBytes(total)}, which is a lot for one entry.`)
    commit(out)
    setNotice(notes.length ? notes.join(' ') : null)
  }, [commit])

  const remove = useCallback((key: number) => {
    list.current.filter((i) => i.key === key).forEach(revoke)
    commit(list.current.filter((i) => i.key !== key))
    setNotice(null)
  }, [commit])

  /** Empty the draft (after saving). The photos stay in the database. */
  const clear = useCallback(() => {
    list.current.forEach(revoke)
    commit([])
    setNotice(null)
  }, [commit])

  const busy = images.some((i) => i.status === 'working')
  const refs = images.flatMap((i) => (i.ref ? [i.ref] : []))
  return { images, refs, busy, notice, add, remove, clear }
}
