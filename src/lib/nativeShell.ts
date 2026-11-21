/*
 * The Windows and Android apps show this site in a web view, so by default they also behave like a browser window: a find
 * bar, reload, "Save as", Print, View source, developer tools, a right-click menu that offers "Save as" and "Share", and
 * a swipe or pull that reloads or goes back. A journal app should not. This switches those off, in the native apps only
 * (`isNativeApp`): on the website and in the installed web app the browser's own features are all the user has.
 *
 * Page zoom is switched off too (Ctrl+scroll, a touchpad or finger pinch, Ctrl and + - 0): it is easy to hit by accident,
 * and the browser keeps the zoom level until it is undone. Settings > Appearance > Text size replaces it. The photo
 * viewer's own zoom (its +, -, 0 keys, the wheel and a pinch on the photo) is separate and keeps working.
 *
 * What is deliberately NOT switched off: Ctrl+A/C/V/X, Ctrl+K and the app's other shortcuts, Alt+Left (the photo viewer
 * is a history entry, so Back closes it), and the right-click menu inside text fields (paste, spelling suggestions).
 * Nothing here touches entries, storage or sync.
 */

/** The parts of a keyboard event that decide whether the web view would act on it. */
export interface ShortcutKey {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/**
 * True for a key press that a browser window would act on and a journal app has no use for: reload (F5, Ctrl+R,
 * Ctrl+Shift+R), find (Ctrl+F, Ctrl+G, F3), Save as (Ctrl+S), Print (Ctrl+P), View source (Ctrl+U), the caret-browsing
 * prompt (F7), developer tools (F12, Ctrl+Shift+I, Ctrl+Shift+C, Ctrl+Shift+J) and page zoom (Ctrl with =, +, -, _ or 0;
 * the plus sign needs Shift on most keyboards, so Shift does not matter for these). Ctrl+F is the one that matters most:
 * the journal only draws the entries on screen, so the browser's find would say "no match" for entries that exist; the
 * app's own search finds them.
 */
export function isBrowserShortcut(e: ShortcutKey): boolean {
  if (e.altKey) return false
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
  if (key === 'F5' || key === 'F3' || key === 'F7' || key === 'F12') return true
  if (!(e.ctrlKey || e.metaKey)) return false
  if (key === '=' || key === '+' || key === '-' || key === '_' || key === '0') return true
  if (e.shiftKey) return key === 'r' || key === 'i' || key === 'c' || key === 'j' || key === 'g'
  return key === 'r' || key === 's' || key === 'p' || key === 'u' || key === 'f' || key === 'g'
}

/** What the right-click handler needs to know about the target (an `Element` fits). */
export interface MenuTarget {
  tagName?: string
  isContentEditable?: boolean
}

/** The browser's own right-click menu stays only in text fields (Cut, Copy, Paste, spelling suggestions). */
export function keepsContextMenu(target: MenuTarget | null): boolean {
  if (!target) return false
  const tag = (target.tagName ?? '').toUpperCase()
  return tag === 'INPUT' || tag === 'TEXTAREA' || !!target.isContentEditable
}

/** The small part of `window` that is used (so a test needs no browser). */
export interface ShellWindow {
  addEventListener(type: 'keydown', listener: (e: KeyboardEvent) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: 'contextmenu', listener: (e: MouseEvent) => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(type: 'wheel', listener: (e: WheelEvent) => void, options?: boolean | AddEventListenerOptions): void
  removeEventListener(type: 'keydown' | 'contextmenu' | 'wheel', listener: never, options?: boolean | EventListenerOptions): void
}

/** The attribute on `<html>` that the stylesheet keys on (`html[data-native]`: no pull-to-refresh, no swipe back). */
export const NATIVE_ATTRIBUTE = 'data-native'

/**
 * Switch the browser's window behavior off. Call once at startup, only in a native app. Returns a function that undoes it
 * (for tests). The key handler runs in the capture phase so a field cannot swallow the event first; it never touches a
 * key that is not in `isBrowserShortcut`, so the app's own shortcuts and typing are unaffected.
 */
export function installNativeShell(win: ShellWindow, root: Pick<Element, 'setAttribute' | 'removeAttribute'>): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (isBrowserShortcut(e)) e.preventDefault()
  }
  const onMenu = (e: MouseEvent) => {
    if (!keepsContextMenu(e.target as MenuTarget | null)) e.preventDefault()
  }
  // A touchpad pinch and Ctrl+scroll both arrive as a wheel event with Ctrl set. It must be non-passive to be cancelled.
  // Nothing is stopped from propagating, so the photo viewer still sees it and zooms the photo.
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey) e.preventDefault()
  }
  win.addEventListener('keydown', onKey, true)
  win.addEventListener('contextmenu', onMenu)
  win.addEventListener('wheel', onWheel, { passive: false })
  root.setAttribute(NATIVE_ATTRIBUTE, '')
  return () => {
    win.removeEventListener('keydown', onKey as never, true)
    win.removeEventListener('contextmenu', onMenu as never)
    win.removeEventListener('wheel', onWheel as never)
    root.removeAttribute(NATIVE_ATTRIBUTE)
  }
}
