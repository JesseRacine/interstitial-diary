import { db } from './db'
import type { ImageRef } from './entry'
import { type Thumbnailer, makeThumbnail } from './imageClient'
import { hashBytes, sniffImageType } from './images'

export type AttachResult =
  | { ok: true; ref: ImageRef; size: number; displayable: boolean }
  | { ok: false; reason: string }

/**
 * Takes a picked, pasted or dropped file and saves it locally right away (original in `blobs`, thumbnail in
 * `thumbs`), before any entry refers to it. So if the entry draft is lost, only the reference is lost, never the photo.
 * The original is stored byte for byte; its name and extension come from its content.
 */
export async function attachImage(file: Blob, thumbnailer: Thumbnailer = makeThumbnail): Promise<AttachResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type) return { ok: false, reason: 'This file is not an image the app can store (JPEG, PNG, GIF, WebP, HEIC or AVIF).' }
  const hash = await hashBytes(bytes)

  const existing = await db.blobs.get(hash)
  if (existing && existing.size !== bytes.byteLength) {
    // Same name, different bytes: never overwrite the photo that is already there.
    return { ok: false, reason: `Could not store this image: its name ${hash} is already used by a different file.` }
  }
  const blob = existing?.blob ?? new Blob([bytes], { type: type.mime })

  let thumb = await db.thumbs.get(hash)
  if (!thumb && type.displayable) {
    const t = await thumbnailer(blob)
    if (t) thumb = { hash, blob: t.thumb, w: t.w, h: t.h }
  }

  await db.transaction('rw', db.blobs, db.thumbs, async () => {
    if (!existing) {
      await db.blobs.add({ hash, blob, mime: type.mime, size: bytes.byteLength, onRemote: 0, addedAt: Date.now() })
    }
    if (thumb) await db.thumbs.put(thumb)
  })

  return {
    ok: true,
    ref: { hash, ext: type.ext, w: thumb?.w ?? 0, h: thumb?.h ?? 0 },
    size: bytes.byteLength,
    displayable: type.displayable,
  }
}
