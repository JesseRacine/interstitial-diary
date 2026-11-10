/*
 * Zoom and pan maths for the lightbox (pure, tested in Node).
 * The image is drawn centred in the stage, fitted at scale 1, then `translate(x, y) scale(scale)`.
 * Points (px, py) are relative to the stage centre.
 */

export interface View {
  scale: number
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 8
export const FIT: View = { scale: 1, x: 0, y: 0 }

/**
 * Keep the image covering the stage when zoomed: it may not be dragged further than its own overhang.
 * `w`/`h` are the fitted image size at scale 1; `sw`/`sh` the stage size.
 */
export function clampView(v: View, w: number, h: number, sw: number, sh: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale))
  if (scale === 1) return FIT
  const maxX = Math.max(0, (w * scale - sw) / 2)
  const maxY = Math.max(0, (h * scale - sh) / 2)
  return { scale, x: Math.min(maxX, Math.max(-maxX, v.x)), y: Math.min(maxY, Math.max(-maxY, v.y)) }
}

/** Zoom by `factor` keeping the point (px, py) under the cursor/fingers where it is. */
export function zoomAt(v: View, factor: number, px: number, py: number): View {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * factor))
  const k = scale / v.scale
  // The image point under (px, py) is (px - x) / scale; keep it there after scaling.
  return { scale, x: px - (px - v.x) * k, y: py - (py - v.y) * k }
}

export const panBy = (v: View, dx: number, dy: number): View => ({ ...v, x: v.x + dx, y: v.y + dy })

/** The fitted size of a w×h image inside a sw×sh stage (never enlarged beyond its own pixels). */
export function fitSize(w: number, h: number, sw: number, sh: number): { w: number; h: number } {
  if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return { w: 0, h: 0 }
  const s = Math.min(1, sw / w, sh / h)
  return { w: w * s, h: h * s }
}
