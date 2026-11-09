/*
 * Decodes an image off the main thread: reads its size after EXIF rotation and makes a small WebP thumbnail.
 * A 12-megapixel photo decodes to about 48 MB, so every bitmap is closed as soon as it is no longer needed.
 */
import { thumbSize } from './images'
import type { ThumbRequest, ThumbResponse } from './imageClient'

const reply = (msg: ThumbResponse) => (self as unknown as Worker).postMessage(msg)

self.addEventListener('message', async (ev: MessageEvent<ThumbRequest>) => {
  const { id, blob } = ev.data
  let full: ImageBitmap | null = null
  let small: ImageBitmap | null = null
  try {
    full = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    const w = full.width
    const h = full.height
    const t = thumbSize(w, h)
    small = await createImageBitmap(full, { resizeWidth: t.w, resizeHeight: t.h, resizeQuality: 'high' })
    full.close()
    full = null
    const canvas = new OffscreenCanvas(t.w, t.h)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('No 2D canvas in this browser')
    ctx.drawImage(small, 0, 0)
    const thumb = await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
    reply({ id, ok: true, w, h, thumb, tw: t.w, th: t.h })
  } catch (e) {
    reply({ id, ok: false, error: e instanceof Error ? e.message : String(e) })
  } finally {
    full?.close()
    small?.close()
  }
})
