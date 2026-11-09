/* Main-thread side of images.worker.ts: one shared worker, one promise per request. */

export interface ThumbRequest {
  id: number
  blob: Blob
}

export type ThumbResponse =
  | { id: number; ok: true; w: number; h: number; thumb: Blob; tw: number; th: number }
  | { id: number; ok: false; error: string }

export interface Thumbnail {
  w: number // original size after EXIF rotation
  h: number
  thumb: Blob
  tw: number // thumbnail size
  th: number
}

/** Makes a thumbnail, or returns null when the image can't be decoded here. Never throws. */
export type Thumbnailer = (blob: Blob) => Promise<Thumbnail | null>

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, (r: ThumbResponse) => void>()

function getWorker(): Worker | null {
  if (worker) return worker
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null
  worker = new Worker(new URL('./images.worker.ts', import.meta.url), { type: 'module' })
  worker.addEventListener('message', (ev: MessageEvent<ThumbResponse>) => {
    pending.get(ev.data.id)?.(ev.data)
    pending.delete(ev.data.id)
  })
  worker.addEventListener('error', () => {
    // A crashed worker fails everything in flight; the next request starts a fresh one.
    for (const [id, resolve] of pending) resolve({ id, ok: false, error: 'image worker crashed' })
    pending.clear()
    worker?.terminate()
    worker = null
  })
  return worker
}

export const makeThumbnail: Thumbnailer = async (blob) => {
  const w = getWorker()
  if (!w) return null
  const id = nextId++
  const r = await new Promise<ThumbResponse>((resolve) => {
    pending.set(id, resolve)
    w.postMessage({ id, blob } satisfies ThumbRequest)
  })
  if (!r.ok) {
    console.warn('Thumbnail failed:', r.error)
    return null
  }
  return { w: r.w, h: r.h, thumb: r.thumb, tw: r.tw, th: r.th }
}
