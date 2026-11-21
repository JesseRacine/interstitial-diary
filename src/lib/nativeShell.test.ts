import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NATIVE_ATTRIBUTE, type ShellWindow, installNativeShell, isBrowserShortcut, keepsContextMenu } from './nativeShell'

const key = (k: string, over: Partial<Parameters<typeof isBrowserShortcut>[0]> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...over,
})
const ctrl = (k: string, shift = false) => key(k, { ctrlKey: true, shiftKey: shift })

describe('isBrowserShortcut', () => {
  it('blocks reload, find, save, print, view source, caret browsing and developer tools', () => {
    for (const k of ['F5', 'F3', 'F7', 'F12']) expect(isBrowserShortcut(key(k)), k).toBe(true)
    for (const k of ['r', 'f', 'g', 's', 'p', 'u']) expect(isBrowserShortcut(ctrl(k)), `Ctrl+${k}`).toBe(true)
    for (const k of ['R', 'G', 'I', 'C', 'J']) expect(isBrowserShortcut(ctrl(k, true)), `Ctrl+Shift+${k}`).toBe(true)
  })

  it('blocks the same keys with Cmd (macOS) and with Caps Lock on', () => {
    expect(isBrowserShortcut(key('f', { metaKey: true }))).toBe(true)
    expect(isBrowserShortcut(ctrl('F'))).toBe(true)
    expect(isBrowserShortcut(ctrl('S', true))).toBe(false) // Ctrl+Shift+S is not a browser action here
  })

  it("leaves the app's own shortcuts, typing and clipboard keys alone", () => {
    for (const k of ['a', 'c', 'v', 'x', 'z', 'k', 'Enter']) expect(isBrowserShortcut(ctrl(k)), `Ctrl+${k}`).toBe(false)
    for (const k of ['f', 'r', 's', 'p', 'Escape', 'ArrowLeft', 'F2', 'F11']) expect(isBrowserShortcut(key(k)), k).toBe(false)
    expect(isBrowserShortcut(key('Enter', { shiftKey: true }))).toBe(false)
  })

  it('leaves Alt+Left alone: the photo viewer is a history entry, so Back closes it', () => {
    expect(isBrowserShortcut(key('ArrowLeft', { altKey: true }))).toBe(false)
    expect(isBrowserShortcut(key('ArrowRight', { altKey: true }))).toBe(false)
    expect(isBrowserShortcut(key('F5', { altKey: true }))).toBe(false) // Alt+F-keys belong to the system, not to us
  })

  it('blocks page zoom: Ctrl with =, +, -, _ and 0, with or without Shift (the plus sign needs it)', () => {
    for (const k of ['=', '+', '-', '_', '0']) {
      expect(isBrowserShortcut(ctrl(k)), `Ctrl+${k}`).toBe(true)
      expect(isBrowserShortcut(ctrl(k, true)), `Ctrl+Shift+${k}`).toBe(true)
    }
    expect(isBrowserShortcut(key('+', { metaKey: true }))).toBe(true)
  })

  it('leaves the same characters alone without Ctrl, so typing a minus or a plus works', () => {
    for (const k of ['=', '+', '-', '_', '0']) expect(isBrowserShortcut(key(k)), k).toBe(false)
    expect(isBrowserShortcut(key('-', { shiftKey: true }))).toBe(false)
  })
})

describe('keepsContextMenu', () => {
  it('keeps the browser menu in text fields (Paste, spelling suggestions) and nowhere else', () => {
    expect(keepsContextMenu({ tagName: 'TEXTAREA' })).toBe(true)
    expect(keepsContextMenu({ tagName: 'INPUT' })).toBe(true)
    expect(keepsContextMenu({ tagName: 'DIV', isContentEditable: true })).toBe(true)
    expect(keepsContextMenu({ tagName: 'DIV' })).toBe(false)
    expect(keepsContextMenu({ tagName: 'IMG' })).toBe(false)
    expect(keepsContextMenu({ tagName: 'A' })).toBe(false)
    expect(keepsContextMenu(null)).toBe(false)
  })
})

/** A window that records its listeners, and a root that records its attributes. */
function fake() {
  const listeners: { type: string; fn: (e: never) => void; capture: boolean; passive?: boolean }[] = []
  const attrs = new Set<string>()
  const win = {
    addEventListener: (type: string, fn: (e: never) => void, opt?: boolean | AddEventListenerOptions) =>
      listeners.push({ type, fn, capture: opt === true, passive: typeof opt === 'object' ? opt.passive : undefined }),
    removeEventListener: (type: string, fn: (e: never) => void) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn)
      if (i >= 0) listeners.splice(i, 1)
    },
  } as unknown as ShellWindow
  const root = { setAttribute: (n: string) => attrs.add(n), removeAttribute: (n: string) => attrs.delete(n) }
  const fire = (type: string, event: object) => {
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true }, ...event }
    for (const l of listeners.filter((x) => x.type === type)) l.fn(e as never)
    return e as { defaultPrevented: boolean }
  }
  return { win, root, listeners, attrs, fire }
}

describe('installNativeShell', () => {
  it('cancels a browser shortcut and a right-click outside a text field, and marks the page native', () => {
    const f = fake()
    installNativeShell(f.win, f.root)
    expect(f.attrs.has(NATIVE_ATTRIBUTE)).toBe(true)
    expect(f.fire('keydown', ctrl('f')).defaultPrevented).toBe(true)
    expect(f.fire('keydown', key('F5')).defaultPrevented).toBe(true)
    expect(f.fire('contextmenu', { target: { tagName: 'DIV' } }).defaultPrevented).toBe(true)
  })

  it('leaves ordinary keys, the app shortcuts and a right-click in a text field alone', () => {
    const f = fake()
    installNativeShell(f.win, f.root)
    expect(f.fire('keydown', key('a')).defaultPrevented).toBe(false)
    expect(f.fire('keydown', ctrl('k')).defaultPrevented).toBe(false)
    expect(f.fire('keydown', ctrl('v')).defaultPrevented).toBe(false)
    expect(f.fire('contextmenu', { target: { tagName: 'TEXTAREA' } }).defaultPrevented).toBe(false)
  })

  it('listens for keys in the capture phase, so a field cannot swallow Ctrl+F first', () => {
    const f = fake()
    installNativeShell(f.win, f.root)
    expect(f.listeners.find((l) => l.type === 'keydown')?.capture).toBe(true)
  })

  it('cancels Ctrl+scroll and a touchpad pinch (a wheel event with Ctrl), but not plain scrolling', () => {
    const f = fake()
    installNativeShell(f.win, f.root)
    expect(f.fire('wheel', { ctrlKey: true, deltaY: -100 }).defaultPrevented).toBe(true)
    expect(f.fire('wheel', { ctrlKey: false, deltaY: 100 }).defaultPrevented).toBe(false)
  })

  it('registers the wheel listener as non-passive (a passive one cannot cancel anything) and never stops it spreading', () => {
    const f = fake()
    installNativeShell(f.win, f.root)
    expect(f.listeners.find((l) => l.type === 'wheel')?.passive).toBe(false)
    // the photo viewer must still see the same event and zoom the photo
    const e = f.fire('wheel', { ctrlKey: true, stopPropagation: () => { throw new Error('must not stop it') } })
    expect(e.defaultPrevented).toBe(true)
  })

  describe('a file dropped on the window (Tauri\'s own drop handler is off in the Windows app)', () => {
    const files = () => ({ types: ['Files'], dropEffect: 'copy' })
    const text = () => ({ types: ['text/plain'], dropEffect: 'copy' })

    it('a file over a place that is not a drop zone is refused, so the app is not replaced by the file', () => {
      const f = fake()
      installNativeShell(f.win, f.root)
      const dt = files()
      expect(f.fire('dragover', { dataTransfer: dt }).defaultPrevented).toBe(true) // cancelled: no "open the file" on release
      expect(dt.dropEffect).toBe('none') // and the pointer says "not here"
      expect(f.fire('drop', { dataTransfer: files() }).defaultPrevented).toBe(true)
    })

    it("a drop zone's own answer is left as it is: still 'copy' when the entry box already took the drag", () => {
      const f = fake()
      installNativeShell(f.win, f.root)
      const dt = files()
      f.fire('dragover', { dataTransfer: dt, defaultPrevented: true }) // the zone's handler ran first and cancelled it
      expect(dt.dropEffect).toBe('copy')
    })

    it('dragged text and links are not touched', () => {
      const f = fake()
      installNativeShell(f.win, f.root)
      const dt = text()
      expect(f.fire('dragover', { dataTransfer: dt }).defaultPrevented).toBe(false)
      expect(dt.dropEffect).toBe('copy')
      expect(f.fire('drop', { dataTransfer: text() }).defaultPrevented).toBe(false)
      expect(f.fire('dragover', {}).defaultPrevented).toBe(false) // no data transfer at all
    })
  })

  it('undoes everything it did', () => {
    const f = fake()
    const off = installNativeShell(f.win, f.root)
    off()
    expect(f.listeners).toHaveLength(0)
    expect(f.attrs.size).toBe(0)
  })
})

describe('the app uses it', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

  it('the drop zones cancel the drag themselves, which is how the window-level handler knows to leave them alone', () => {
    const src = read('../components/useDraftImages.ts')
    expect(src).toMatch(/onDragOver:[\s\S]*?e\.preventDefault\(\)[\s\S]*?dropEffect = 'copy'/)
    expect(src).toMatch(/onDrop:[\s\S]*?e\.preventDefault\(\)/)
  })

  it('main.tsx installs it only inside the native apps, before the page is drawn', () => {
    const src = read('../main.tsx')
    const gate = src.indexOf('if (isNativeApp(location)) installNativeShell(')
    expect(gate).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(src.indexOf('createRoot('))
  })

  it('the stylesheet switches off overscroll only where the attribute is set (the website keeps pull-to-refresh)', () => {
    const css = read('../index.css')
    expect(css).toContain(`html[${NATIVE_ATTRIBUTE}], html[${NATIVE_ATTRIBUTE}] * { overscroll-behavior: none; }`)
    expect(css.match(/overscroll-behavior:\s*none/g)).toHaveLength(1) // no other rule turns it off for every browser
  })

  it('page pinch is off by touch only in the native apps, at the lowest specificity so the photo viewer keeps its own', () => {
    const css = read('../index.css')
    expect(css).toContain(`:where(html[${NATIVE_ATTRIBUTE}], html[${NATIVE_ATTRIBUTE}] *) { touch-action: pan-x pan-y; }`)
    expect(css).toContain('.lightbox-stage { position: relative; flex: 1; min-height: 0; display: grid; place-items: center; overflow: hidden; touch-action: none;')
    expect(css.match(/touch-action:\s*pan-x pan-y/g)).toHaveLength(1)
  })
})
