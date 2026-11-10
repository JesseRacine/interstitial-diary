import { describe, expect, it } from 'vitest'
import { fitImageLimit, formatBytes, hashBytes, imagePath, isDisplayable, sniffImageType, thumbPath, thumbSize } from './images'

const bytes = (...parts: (number[] | string)[]) => {
  const out: number[] = []
  for (const p of parts) out.push(...(typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p))
  while (out.length < 16) out.push(0)
  return new Uint8Array(out)
}

describe('sniffImageType', () => {
  it('recognises the stored formats from their first bytes', () => {
    expect(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe1]))?.ext).toBe('jpg')
    expect(sniffImageType(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))?.ext).toBe('png')
    expect(sniffImageType(bytes('GIF89a'))?.ext).toBe('gif')
    expect(sniffImageType(bytes('GIF87a'))?.ext).toBe('gif')
    expect(sniffImageType(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))?.ext).toBe('webp')
    expect(sniffImageType(bytes([0, 0, 0, 0x18], 'ftypheic'))?.ext).toBe('heic')
    expect(sniffImageType(bytes([0, 0, 0, 0x18], 'ftypmif1'))?.ext).toBe('heic')
    expect(sniffImageType(bytes([0, 0, 0, 0x1c], 'ftypavif'))?.ext).toBe('avif')
  })

  it('ignores the file name and rejects everything else', () => {
    expect(sniffImageType(bytes('%PDF-1.7'))).toBeNull()
    expect(sniffImageType(bytes('RIFF', [0, 0, 0, 0], 'WAVE'))).toBeNull()
    expect(sniffImageType(bytes([0, 0, 0, 0x18], 'ftypmp42'))).toBeNull() // a video
    expect(sniffImageType(new Uint8Array(0))).toBeNull()
  })

  it('knows which formats the app can show', () => {
    expect(isDisplayable({ ext: 'jpg' })).toBe(true)
    expect(isDisplayable({ ext: 'gif' })).toBe(true)
    expect(isDisplayable({ ext: 'heic' })).toBe(false)
    expect(isDisplayable({ ext: 'exe' })).toBe(false)
  })
})

describe('hashBytes', () => {
  it('is the first 16 hex chars of SHA-256', async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await hashBytes(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea')
  })
})

describe('paths', () => {
  it('puts originals in the year folder and thumbnails in .thumbs', () => {
    expect(imagePath('2026-11-08', { hash: '3f9a2c1b7d04e8aa', ext: 'jpg' })).toBe('2026/images/3f9a2c1b7d04e8aa.jpg')
    expect(thumbPath('3f9a2c1b7d04e8aa')).toBe('.thumbs/3f9a2c1b7d04e8aa.webp')
  })
})

describe('thumbSize', () => {
  it('fits 512 wide, keeps the ratio and never enlarges', () => {
    expect(thumbSize(4032, 3024)).toEqual({ w: 512, h: 384 })
    expect(thumbSize(3024, 4032)).toEqual({ w: 512, h: 683 })
    expect(thumbSize(300, 200)).toEqual({ w: 300, h: 200 })
  })
  it('caps very tall images at 1024 high', () => {
    expect(thumbSize(1000, 10000)).toEqual({ w: 102, h: 1024 })
  })
  it('handles unknown sizes', () => {
    expect(thumbSize(0, 0)).toEqual({ w: 0, h: 0 })
  })
})

describe('fitImageLimit', () => {
  it('takes everything while there is room', () => {
    expect(fitImageLimit(0, 3)).toEqual({ take: 3, message: null })
    expect(fitImageLimit(7, 3)).toEqual({ take: 3, message: null })
  })
  it('takes what fits up to 10 and says how many were left out', () => {
    expect(fitImageLimit(8, 3)).toEqual({ take: 2, message: 'An entry can have up to 10 photos, so 1 was left out.' })
    expect(fitImageLimit(10, 2)).toEqual({ take: 0, message: 'An entry can have up to 10 photos, so 2 were left out.' })
    expect(fitImageLimit(0, 12).take).toBe(10)
  })
})

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500 B')
    expect(formatBytes(4 * 1024 * 1024)).toBe('4.0 MB')
  })
})
