import type { ImageRef } from './entry'

/*
 * Pure image helpers (no DOM, testable in Node). Decoding and thumbnails happen in images.worker.ts.
 *
 * Originals are kept byte for byte and named by content: the first 16 hex chars of their SHA-256, with an extension
 * taken from the sniffed file type (never from the file name). So an image file never changes once written.
 */

export const MAX_IMAGES_PER_ENTRY = 10
export const WARN_BYTES_PER_ENTRY = 100 * 1024 * 1024
export const THUMB_MAX_W = 512
export const THUMB_MAX_H = 1024

export interface ImageType {
  ext: string
  mime: string
  /** Shown in the app (thumbnail, lightbox). Other types are stored, with a placeholder and a download link. */
  displayable: boolean
}

const TYPES = {
  jpg: { ext: 'jpg', mime: 'image/jpeg', displayable: true },
  png: { ext: 'png', mime: 'image/png', displayable: true },
  gif: { ext: 'gif', mime: 'image/gif', displayable: true },
  webp: { ext: 'webp', mime: 'image/webp', displayable: true },
  heic: { ext: 'heic', mime: 'image/heic', displayable: false },
  avif: { ext: 'avif', mime: 'image/avif', displayable: false },
} satisfies Record<string, ImageType>

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x)

/** Detect the image type from the first bytes of the file (at least 16 are needed). Null when not recognised. */
export function sniffImageType(bytes: Uint8Array): ImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return TYPES.jpg
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return TYPES.png
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a') return TYPES.gif
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return TYPES.webp
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (brand === 'avif' || brand === 'avis') return TYPES.avif
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return TYPES.heic
  }
  return null
}

export function typeForExt(ext: string): ImageType | null {
  return (TYPES as Record<string, ImageType>)[ext] ?? null
}

export function isDisplayable(ref: Pick<ImageRef, 'ext'>): boolean {
  return typeForExt(ref.ext)?.displayable ?? false
}

/** First 16 hex chars of the SHA-256 of the bytes. */
export async function hashBytes(bytes: BufferSource): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...digest.subarray(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Where an original lives in the storage folder: next to that year's day files. */
export function imagePath(day: string, ref: Pick<ImageRef, 'hash' | 'ext'>): string {
  return `${day.slice(0, 4)}/images/${ref.hash}.${ref.ext}`
}

/** Where a thumbnail lives in the storage folder (a rebuildable cache). */
export function thumbPath(hash: string): string {
  return `.thumbs/${hash}.webp`
}

/** Thumbnail size: at most THUMB_MAX_W wide and THUMB_MAX_H tall, keeping the ratio, never enlarged. */
export function thumbSize(w: number, h: number): { w: number; h: number } {
  if (w <= 0 || h <= 0) return { w: 0, h: 0 }
  const scale = Math.min(1, THUMB_MAX_W / w, THUMB_MAX_H / h)
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

/**
 * How many of `incoming` new files fit next to `current` images on one entry, and what to tell the user about the rest.
 */
export function fitImageLimit(current: number, incoming: number): { take: number; message: string | null } {
  const room = Math.max(0, MAX_IMAGES_PER_ENTRY - current)
  const take = Math.min(room, incoming)
  if (take === incoming) return { take, message: null }
  const skipped = incoming - take
  return {
    take,
    message: `An entry can have up to ${MAX_IMAGES_PER_ENTRY} photos, so ${skipped} ${skipped === 1 ? 'was' : 'were'} left out.`,
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}
