import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { db, setEntryImages } from '../lib/db'
import { type Entry, entryImages, longDayLabel, timeLabel } from '../lib/entry'
import { isDisplayable } from '../lib/images'
import { FIT, type View, clampView, fitSize, panBy, zoomAt } from '../lib/zoom'
import { useThumbUrl } from './useThumbUrl'

/** The full original as an object URL (revoked when no longer shown); 'missing' when this device doesn't have it. */
function useOriginal(hash: string): { url: string | null; missing: boolean } {
  const [state, setState] = useState<{ hash: string; url: string | null; missing: boolean } | null>(null)
  useEffect(() => {
    let live = true
    let url: string | null = null
    void db.blobs.get(hash).then((row) => {
      if (!live) return
      url = row ? URL.createObjectURL(row.blob) : null
      setState({ hash, url, missing: !row })
    })
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [hash])
  return state?.hash === hash ? state : { url: null, missing: false }
}

/**
 * Full-size photo viewer. Opens with the thumbnail and swaps to the original once loaded. Esc closes, ←/→ move within
 * the entry, wheel/pinch zoom, drag to pan, double-click toggles zoom. While open it takes over the keyboard, so the
 * journal's own shortcuts don't fire. Closing goes through history (App), so Android's back button closes it too.
 */
export function Lightbox({ entry, index, onIndex, onClose }: {
  entry: Entry
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const images = entryImages(entry)
  const i = Math.min(index, images.length - 1)
  const image = images[i]
  const thumb = useThumbUrl(image?.hash)
  const original = useOriginal(image?.hash ?? '')
  const displayable = image ? isDisplayable(image) : false
  const src = displayable ? (original.url ?? thumb) : null

  const stage = useRef<HTMLDivElement>(null)
  const dialog = useRef<HTMLDivElement>(null)
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState<{ hash: string; w: number; h: number } | null>(null)
  const [view, setView] = useState<View>(FIT)

  // Size of the photo when fitted; from the stored size, or from the decoded image when that wasn't known.
  const known = image && image.w > 0 && image.h > 0 ? { w: image.w, h: image.h } : natural?.hash === image?.hash ? natural : null
  const fitted = known ? fitSize(known.w, known.h, stageSize.w, stageSize.h) : { w: 0, h: 0 }
  const clamp = (v: View) => clampView(v, fitted.w, fitted.h, stageSize.w, stageSize.h)

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Every photo starts fitted.
  const [shown, setShown] = useState(image?.hash)
  if (shown !== image?.hash) {
    setShown(image?.hash)
    setView(FIT)
  }

  // Focus the dialog while open; give focus back afterwards.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    dialog.current?.focus()
    return () => before?.focus?.()
  }, [])

  const go = (d: -1 | 1) => {
    const n = i + d
    if (n >= 0 && n < images.length) onIndex(n)
  }
  const centre = (x: number, y: number) => {
    const r = stage.current!.getBoundingClientRect()
    return { x: x - (r.left + r.width / 2), y: y - (r.top + r.height / 2) }
  }

  // The window/wheel listeners are attached once and call the latest handlers through this ref.
  const latest = useRef({ go, clamp, onClose, centre })
  useLayoutEffect(() => { latest.current = { go, clamp, onClose, centre } })

  // Keyboard: capture phase on window, so the app's own shortcuts (←/→/t/n//) never see these keys.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') return // keep normal focus movement between the buttons
      e.stopImmediatePropagation()
      const h = latest.current
      if (e.key === 'Escape') { e.preventDefault(); h.onClose() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); h.go(-1) }
      else if (e.key === 'ArrowRight') { e.preventDefault(); h.go(1) }
      else if (e.key === '+' || e.key === '=') { e.preventDefault(); setView((v) => h.clamp(zoomAt(v, 1.5, 0, 0))) }
      else if (e.key === '-') { e.preventDefault(); setView((v) => h.clamp(zoomAt(v, 1 / 1.5, 0, 0))) }
      else if (e.key === '0') { e.preventDefault(); setView(FIT) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const h = latest.current
      const p = h.centre(e.clientX, e.clientY)
      setView((v) => h.clamp(zoomAt(v, Math.exp(-e.deltaY * 0.0015), p.x, p.y)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pointers: one drags (when zoomed), two pinch. A tap on the dark area (no drag) closes.
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const moved = useRef(0)
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* pointer already gone: still track it */ }
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) moved.current = 0
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const ps = pointers.current
    const prev = ps.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    if (ps.size === 1) {
      moved.current += Math.abs(next.x - prev.x) + Math.abs(next.y - prev.y)
      setView((v) => (v.scale > 1 ? clamp(panBy(v, next.x - prev.x, next.y - prev.y)) : v))
    } else if (ps.size === 2) {
      const [a, b] = [...ps.entries()].map(([id, p]) => (id === e.pointerId ? next : p))
      const [pa, pb] = [...ps.values()]
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y)
      const after = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = centre((a.x + b.x) / 2, (a.y + b.y) / 2)
      const midBefore = centre((pa.x + pb.x) / 2, (pa.y + pb.y) / 2)
      moved.current += 100
      if (before > 0) setView((v) => clamp(panBy(zoomAt(v, after / before, midBefore.x, midBefore.y), mid.x - midBefore.x, mid.y - midBefore.y)))
    }
    ps.set(e.pointerId, next)
  }
  const onPointerUp = (e: React.PointerEvent) => {
    const wasOnly = pointers.current.size === 1
    pointers.current.delete(e.pointerId)
    const onPhoto = (e.target as HTMLElement).closest('.lightbox-photo')
    if (wasOnly && moved.current < 6 && !onPhoto && e.type === 'pointerup') onClose()
  }
  const onDoubleClick = (e: React.MouseEvent) => {
    const p = centre(e.clientX, e.clientY)
    setView((v) => (v.scale > 1 ? FIT : clamp(zoomAt(v, 2.5, p.x, p.y))))
  }

  const removeImage = async () => {
    if (!confirm('Remove this photo from the entry? The photo file itself is kept.')) return
    const rest = images.filter((_, n) => n !== i)
    await setEntryImages(entry.id, rest)
    if (!rest.length) onClose()
    else if (i >= rest.length) onIndex(rest.length - 1)
  }

  if (!image) return null
  const name = `${entry.day}-${image.hash}.${image.ext}`

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" ref={dialog} tabIndex={-1}>
      <div className="lightbox-bar">
        <span className="count">{images.length > 1 ? `${i + 1} / ${images.length}` : ''}</span>
        <span className="spacer" />
        {original.url
          ? <a className="button" href={original.url} download={name}>Save</a>
          : <button type="button" disabled title="The original isn't on this device yet">Save</button>}
        <button type="button" className="danger" onClick={removeImage}>Remove</button>
        <button type="button" className="close" onClick={onClose} aria-label="Close (Esc)">×</button>
      </div>

      <div
        className={`lightbox-stage${view.scale > 1 ? ' zoomed' : ''}`}
        ref={stage}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        {src ? (
          <img
            className="lightbox-photo"
            src={src}
            alt=""
            draggable={false}
            style={{
              width: fitted.w || undefined,
              height: fitted.h || undefined,
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
            onLoad={(e) => {
              if (!known) setNatural({ hash: image.hash, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
            }}
          />
        ) : (
          <div className="lightbox-missing">
            {!displayable
              ? `This ${image.ext.toUpperCase()} photo can't be shown here.${original.url ? ' Use Save to open it in another app.' : ''}`
              : original.missing ? "This photo isn't on this device yet." : ''}
          </div>
        )}
        {i > 0 && <button type="button" className="nav prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>}
        {i < images.length - 1 && <button type="button" className="nav next" onClick={() => go(1)} aria-label="Next photo">›</button>}
      </div>

      <div className="lightbox-caption">
        <div className="when">{longDayLabel(entry.day)} · {timeLabel(entry.createdAt)}</div>
        {entry.text && <div className="text">{entry.text}</div>}
        {displayable && !original.url && original.missing && thumb && <div className="muted">Showing the small copy; the original isn't on this device yet.</div>}
      </div>
    </div>,
    document.body,
  )
}
