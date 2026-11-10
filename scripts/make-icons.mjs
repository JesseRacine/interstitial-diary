// Generates the app icons (public/icons/*.png, public/apple-touch-icon.png) and public/favicon.svg.
// No dependencies: it rasterises the design below itself and writes PNGs with node:zlib.
// Run with `npm run icons`. To use your own artwork instead, just replace those files (keep the names and sizes).
//
// Design: three rounded "journal lines" in the paper colour on the accent-green square.
import { deflateSync, crc32 } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BG = [0x3d, 0x6b, 0x5e] // --accent in index.css
const FG = [0xf7, 0xf5, 0xf1] // --bg in index.css
const BAR_H = 0.085
const BARS = [ // x = left edge, y = centre line, w = width (all 0..1 of the icon)
  { x: 0.26, y: 0.35, w: 0.48 },
  { x: 0.26, y: 0.5, w: 0.3 },
  { x: 0.26, y: 0.65, w: 0.4 },
]
// Everything meaningful stays inside the centre 80% circle, the "safe zone" that maskable icons may be cropped to.

function inRoundBox(px, py, cx, cy, hw, hh, r) {
  const dx = Math.abs(px - cx) - (hw - r)
  const dy = Math.abs(py - cy) - (hh - r)
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) <= r
}

/** Colour at a point of the unit square, or null for transparent. `corner` = corner radius (0 = full bleed). */
function sample(px, py, corner) {
  if (corner > 0 && !inRoundBox(px, py, 0.5, 0.5, 0.5, 0.5, corner)) return null
  for (const b of BARS) {
    if (inRoundBox(px, py, b.x + b.w / 2, b.y, b.w / 2, BAR_H / 2, BAR_H / 2)) return FG
  }
  return BG
}

function render(size, corner) {
  const S = 4 // 4x4 supersampling for smooth edges
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1)
    raw[row] = 0 // PNG filter: none
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, hit = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const c = sample((x + (sx + 0.5) / S) / size, (y + (sy + 0.5) / S) / size, corner)
          if (c) { r += c[0]; g += c[1]; b += c[2]; hit++ }
        }
      }
      const o = row + 1 + x * 4
      if (hit) { raw[o] = Math.round(r / hit); raw[o + 1] = Math.round(g / hit); raw[o + 2] = Math.round(b / hit) }
      raw[o + 3] = Math.round((255 * hit) / (S * S))
    }
  }
  return raw
}

function chunk(type, data) {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

function png(size, corner) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(render(size, corner), { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function svg() {
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
  const n = (v) => +(v * 100).toFixed(2)
  const bars = BARS.map((b) =>
    `<rect x="${n(b.x)}" y="${n(b.y - BAR_H / 2)}" width="${n(b.w)}" height="${n(BAR_H)}" rx="${n(BAR_H / 2)}" fill="${hex(FG)}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="${hex(BG)}"/>${bars}</svg>\n`
}

const pub = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(join(pub, 'icons'), { recursive: true })
const files = {
  'icons/icon-192.png': png(192, 0.22),
  'icons/icon-512.png': png(512, 0.22),
  'icons/icon-maskable-512.png': png(512, 0), // full bleed: the OS applies its own mask
  'apple-touch-icon.png': png(180, 0), // iOS rounds it itself
  'favicon.svg': svg(),
}
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(pub, name), data)
  console.log('wrote public/' + name)
}
