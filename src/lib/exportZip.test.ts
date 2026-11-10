import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { type ImageRef, makeEntry } from './entry'
import { ROOT, blobSink, planExport, writeExportZip, type ZipSink } from './exportZip'
import { parseDay } from './markdown'

const at = (y: number, m: number, d: number, h: number) => new Date(y, m - 1, d, h).getTime()
const A: ImageRef = { hash: 'aaaaaaaaaaaaaaaa', ext: 'jpg', w: 4, h: 3 }
const B: ImageRef = { hash: 'bbbbbbbbbbbbbbbb', ext: 'png', w: 4, h: 3 }
const C: ImageRef = { hash: 'cccccccccccccccc', ext: 'jpg', w: 4, h: 3 } // not on this device

const bytesA = new Uint8Array(70_000).map((_, i) => (i * 7) % 256)
const bytesB = new Uint8Array([1, 2, 3, 4, 5])
const blobs: Record<string, Blob> = { [A.hash]: new Blob([bytesA]), [B.hash]: new Blob([bytesB]) }
const sizes = new Map([[A.hash, bytesA.length], [B.hash, bytesB.length]])

const entries = [
  makeEntry('2025 photo', at(2025, 6, 1, 9), 'e1', [A]),
  makeEntry('2026 same photo plus one', at(2026, 1, 2, 9), 'e2', [A, B]),
  makeEntry('again in 2026', at(2026, 1, 3, 9), 'e3', [B, C]),
  { ...makeEntry('deleted', at(2026, 1, 4, 9), 'e4', [B]), deleted: 1 as const },
  makeEntry('text only', at(2026, 1, 5, 9), 'e5'),
]

describe('planExport', () => {
  it('lists each original once per year that uses it, in the storage layout', () => {
    const p = planExport(entries, sizes)
    expect(p.photos.map((f) => f.path)).toEqual([
      `${ROOT}/2025/images/aaaaaaaaaaaaaaaa.jpg`,
      `${ROOT}/2026/images/aaaaaaaaaaaaaaaa.jpg`,
      `${ROOT}/2026/images/bbbbbbbbbbbbbbbb.png`,
    ])
    expect(p.photoBytes).toBe(2 * bytesA.length + bytesB.length)
    expect(p.missing).toBe(1) // C
    expect(p.days).toEqual(['2025-06-01', '2026-01-02', '2026-01-03', '2026-01-05'])
    expect(p.years).toEqual(['2025', '2026'])
  })

  it('can be limited to one year', () => {
    const p = planExport(entries, sizes, '2025')
    expect(p.days).toEqual(['2025-06-01'])
    expect(p.photos.map((f) => f.hash)).toEqual([A.hash])
    expect(p.years).toEqual(['2025', '2026'])
  })
})

describe('writeExportZip', () => {
  it('writes day files and byte-identical, uncompressed originals', async () => {
    const sink = blobSink()
    const progress = vi.fn()
    const plan = planExport(entries, sizes)
    const r = await writeExportZip(entries, plan, async (h) => blobs[h] ?? null, sink, progress)
    expect(r).toEqual({ photos: 3, skipped: 0 })

    const zipBytes = new Uint8Array(await sink.result().arrayBuffer())
    const files = unzipSync(zipBytes)
    expect(Object.keys(files).sort()).toEqual([
      `${ROOT}/2025/2025-06-01.md`,
      `${ROOT}/2025/images/aaaaaaaaaaaaaaaa.jpg`,
      `${ROOT}/2026/2026-01-02.md`,
      `${ROOT}/2026/2026-01-03.md`,
      `${ROOT}/2026/2026-01-05.md`,
      `${ROOT}/2026/images/aaaaaaaaaaaaaaaa.jpg`,
      `${ROOT}/2026/images/bbbbbbbbbbbbbbbb.png`,
    ])
    expect(files[`${ROOT}/2026/images/aaaaaaaaaaaaaaaa.jpg`]).toEqual(bytesA)
    expect(files[`${ROOT}/2026/images/bbbbbbbbbbbbbbbb.png`]).toEqual(bytesB)
    // the day file is the normal format, image lines included
    const day = parseDay(strFromU8(files[`${ROOT}/2026/2026-01-02.md`]), '2026-01-02')
    expect(day[0].images).toEqual([A, B])

    // photos are stored, not deflated: the compression method in their local header is 0
    const name = new TextEncoder().encode(`${ROOT}/2026/images/aaaaaaaaaaaaaaaa.jpg`)
    const at = indexOf(zipBytes, name) - 30
    expect(zipBytes[at + 8] | (zipBytes[at + 9] << 8)).toBe(0)

    expect(progress).toHaveBeenLastCalledWith(plan.photoBytes, plan.photoBytes)
  })

  it('skips an original that disappeared after planning', async () => {
    const sink = blobSink()
    const plan = planExport(entries, sizes, '2025')
    const r = await writeExportZip(entries, plan, async () => null, sink)
    expect(r).toEqual({ photos: 0, skipped: 1 })
    expect(Object.keys(unzipSync(new Uint8Array(await sink.result().arrayBuffer())))).toEqual([`${ROOT}/2025/2025-06-01.md`])
  })

  it('aborts the sink when writing fails, so no half file is kept', async () => {
    const abort = vi.fn(async () => {})
    let writes = 0
    const failing: ZipSink = {
      async write() { if (++writes > 3) throw new Error('disk full') },
      async close() {},
      abort,
    }
    await expect(writeExportZip(entries, planExport(entries, sizes), async (h) => blobs[h] ?? null, failing)).rejects.toThrow('disk full')
    expect(abort).toHaveBeenCalledOnce()
  })
})

function indexOf(hay: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer
    return i
  }
  return -1
}
