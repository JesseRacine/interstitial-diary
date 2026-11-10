import type { ImageRef } from './entry'

/*
 * How an entry's photos are laid out in a bubble. Every box gets its size from the stored w/h BEFORE anything decodes,
 * so the virtualised journal never sees a row change height when a thumbnail arrives.
 */

export const SINGLE_MAX_H = 260
export const SINGLE_MAX_W = 320
export const UNKNOWN_SIZE = 160 // a square box when the size isn't known yet
export const GRID_TILE = 120
export const GRID_MAX = 4

export type ImageLayout =
  | { kind: 'none' }
  | { kind: 'single'; image: ImageRef; width: number; height: number }
  | { kind: 'grid'; shown: ImageRef[]; more: number } // 2-column grid of GRID_TILE squares; "+more" on the last

export function imageLayout(images: ImageRef[]): ImageLayout {
  if (!images.length) return { kind: 'none' }
  if (images.length === 1) {
    const [image] = images
    if (!(image.w > 0 && image.h > 0)) return { kind: 'single', image, width: UNKNOWN_SIZE, height: UNKNOWN_SIZE }
    // Fit inside SINGLE_MAX_W x SINGLE_MAX_H, keeping the ratio; small images are not enlarged.
    const scale = Math.min(1, SINGLE_MAX_W / image.w, SINGLE_MAX_H / image.h)
    return { kind: 'single', image, width: Math.max(1, Math.round(image.w * scale)), height: Math.max(1, Math.round(image.h * scale)) }
  }
  const shown = images.slice(0, GRID_MAX)
  return { kind: 'grid', shown, more: images.length - shown.length }
}
