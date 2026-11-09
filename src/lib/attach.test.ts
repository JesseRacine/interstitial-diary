import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { attachImage } from './attach'
import { db } from './db'
import type { Thumbnailer } from './imageClient'
import { hashBytes } from './images'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
const HEIC = new Uint8Array([0, 0, 0, 0x18, ...new TextEncoder().encode('ftypheic'), 0, 0, 0, 0, 9, 9])

const fakeThumb = (w = 4032, h = 3024) =>
  vi.fn<Thumbnailer>(async () => ({ w, h, thumb: new Blob(['thumb'], { type: 'image/webp' }), tw: 512, th: 384 }))

const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

beforeEach(async () => {
  await db.blobs.clear()
  await db.thumbs.clear()
})

describe('attachImage', () => {
  it('stores the original byte for byte, named by its content, plus a thumbnail', async () => {
    const thumb = fakeThumb()
    const r = await attachImage(new Blob([JPEG], { type: 'application/octet-stream' }), thumb)
    expect(r).toEqual({ ok: true, ref: { hash: await hashBytes(JPEG), ext: 'jpg', w: 4032, h: 3024 }, size: JPEG.length, displayable: true })
    if (!r.ok) return
    const row = (await db.blobs.get(r.ref.hash))!
    expect(await bytesOf(row.blob)).toEqual(JPEG)
    expect(row).toMatchObject({ mime: 'image/jpeg', size: JPEG.length, onRemote: 0 })
    expect((await db.thumbs.get(r.ref.hash))?.w).toBe(4032)
    expect(thumb).toHaveBeenCalledOnce()
  })

  it('attaching the same photo twice keeps one copy and its remote flag', async () => {
    const first = await attachImage(new Blob([JPEG]), fakeThumb())
    if (!first.ok) throw new Error('expected ok')
    await db.blobs.update(first.ref.hash, { onRemote: 1 })
    const thumb = fakeThumb()
    const again = await attachImage(new Blob([JPEG]), thumb)
    expect(again).toEqual(first)
    expect(thumb).not.toHaveBeenCalled() // thumbnail reused
    expect(await db.blobs.count()).toBe(1)
    expect((await db.blobs.get(first.ref.hash))?.onRemote).toBe(1)
  })

  it('stores formats it cannot show, without a thumbnail', async () => {
    const thumb = fakeThumb()
    const r = await attachImage(new Blob([HEIC]), thumb)
    expect(r).toMatchObject({ ok: true, ref: { ext: 'heic', w: 0, h: 0 }, displayable: false })
    expect(thumb).not.toHaveBeenCalled()
    expect(await db.blobs.count()).toBe(1)
    expect(await db.thumbs.count()).toBe(0)
  })

  it('still stores the original when the thumbnail fails', async () => {
    const r = await attachImage(new Blob([JPEG]), async () => null)
    expect(r).toMatchObject({ ok: true, ref: { ext: 'jpg', w: 0, h: 0 } })
    expect(await db.blobs.count()).toBe(1)
  })

  it('rejects files that are not images', async () => {
    const r = await attachImage(new Blob(['%PDF-1.7 not an image at all']), fakeThumb())
    expect(r.ok).toBe(false)
    expect(await db.blobs.count()).toBe(0)
  })

  it('never overwrites a different file that has the same name', async () => {
    const hash = await hashBytes(JPEG)
    const other = new Blob([new Uint8Array([1, 2, 3])])
    await db.blobs.add({ hash, blob: other, mime: 'image/jpeg', size: 3, onRemote: 1, addedAt: 1 })
    const r = await attachImage(new Blob([JPEG]), fakeThumb())
    expect(r.ok).toBe(false)
    expect(await bytesOf((await db.blobs.get(hash))!.blob)).toEqual(new Uint8Array([1, 2, 3]))
  })
})
