import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { manifest } from '../pwa-manifest'
import { parseLaunch } from './lib/launch'

const root = new URL('../', import.meta.url)
const publicFile = (p: string) => new URL(`public/${p}`, root)

/** Width and height from a PNG's IHDR chunk, or null if it isn't a PNG. */
function pngSize(path: URL): { w: number; h: number } | null {
  const b = readFileSync(path)
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47 || b.toString('ascii', 12, 16) !== 'IHDR') return null
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

describe('PWA manifest', () => {
  it('is installable: name, standalone display, relative start_url and scope', () => {
    expect(manifest.name).toBeTruthy()
    expect(manifest.short_name).toBeTruthy()
    expect(manifest.display).toBe('standalone')
    // relative, so it keeps working if the app is served from a sub-path (GitHub Pages)
    expect(manifest.start_url).toBe('./')
    expect(manifest.scope).toBe('./')
  })

  it('names icon files that exist, are real PNGs, and are the size they claim', () => {
    expect(manifest.icons?.length).toBeGreaterThanOrEqual(3)
    for (const icon of manifest.icons ?? []) {
      expect(icon.src.startsWith('/')).toBe(false)
      expect(existsSync(publicFile(icon.src)), icon.src).toBe(true)
      const [w, h] = (icon.sizes ?? '').split('x').map(Number)
      expect(pngSize(publicFile(icon.src)), icon.src).toEqual({ w, h })
    }
  })

  it('has the icon sizes browsers require (192 + 512) and a maskable one', () => {
    const sizes = (manifest.icons ?? []).map((i) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
    expect((manifest.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true)
  })

  it('has a "New entry" shortcut that opens the entry box (?new=1)', () => {
    const s = manifest.shortcuts?.find((x) => x.name === 'New entry')
    expect(s?.url).toBe('./?new=1')
    for (const icon of s?.icons ?? []) expect(existsSync(publicFile(icon.src)), icon.src).toBe(true)
  })

  it('has a share target that sends the shared title, text and link to the entry box', () => {
    const t = manifest.share_target
    expect(t?.method).toBe('GET') // a GET needs no service-worker code; photos would need a POST target
    expect(t?.action).toBe('./?new=1') // relative, so it works from a sub-path; inside scope
    expect(t?.params).toEqual({ title: 'title', text: 'text', url: 'url' })
  })

  it('the share target and the shortcut name words that lib/launch.ts reads', () => {
    // Whatever the manifest asks the browser to send must be something parseLaunch understands.
    const shared = new URL(`https://x.test/app/${manifest.share_target!.action.slice(2)}&title=T&text=X&url=https%3A%2F%2Fe.test`)
    expect(parseLaunch(shared.search)).toEqual({ newEntry: true, text: 'T\nX\nhttps://e.test' })
    expect(parseLaunch(new URL(`https://x.test/app/${manifest.shortcuts![0].url.slice(2)}`).search).newEntry).toBe(true)
  })
})

describe('index.html', () => {
  const html = readFileSync(new URL('index.html', root), 'utf8')
  it('links an iOS home-screen icon and a favicon that exist', () => {
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(existsSync(publicFile('apple-touch-icon.png'))).toBe(true)
    expect(pngSize(publicFile('apple-touch-icon.png'))).toEqual({ w: 180, h: 180 })
    expect(html).toContain('href="/favicon.svg"')
    expect(existsSync(publicFile('favicon.svg'))).toBe(true)
  })
  it('sets a theme colour for light and dark', () => {
    expect(html).toMatch(/name="theme-color"[^>]*prefers-color-scheme: light/)
    expect(html).toMatch(/name="theme-color"[^>]*prefers-color-scheme: dark/)
  })
})
