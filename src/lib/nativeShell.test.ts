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

  it('leaves zoom keys alone (a later step decides about zoom)', () => {
    for (const k of ['=', '+', '-', '0']) expect(isBrowserShortcut(ctrl(k)), k).toBe(false)
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
  const listeners: { type: string; fn: (e: never) => void; capture: boolean }[] = []
  const attrs = new Set<string>()
  const win = {
    addEventListener: (type: string, fn: (e: never) => void, opt?: boolean | AddEventListenerOptions) =>
      listeners.push({ type, fn, capture: opt === true }),
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
})
