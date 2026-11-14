/*
 * How the app was opened, from its address. Two things arrive this way on a phone:
 *  - the "New entry" shortcut (long-press the app icon, or the icon pinned to the home screen): `?new=1`;
 *  - Android's Share sheet ("Share > Interstitial" from Chrome, Maps...): `?new=1&title=...&text=...&url=...`,
 *    because the manifest's share target is a plain GET (see pwa-manifest.ts).
 * Both mean the same thing: open the journal with the entry box ready, with whatever was shared already in it.
 */

/** Shared text is cut to this many characters (an address bar or a share sheet can carry a whole article). */
export const MAX_SHARED = 2000

export interface Launch {
  newEntry: boolean // open the journal on the entry box
  text: string // what was shared (title, text and link in one), '' when nothing was
}

const PARAMS = ['new', 'title', 'text', 'url']

/**
 * What the address (its `?...` part) asks for. Shared pieces are joined with line breaks, in the order title, text, link;
 * a piece that another piece already contains is dropped (Android often puts the link in `text` and again in `url`).
 */
export function parseLaunch(search: string): Launch {
  const p = new URLSearchParams(search)
  const parts = [...new Set([p.get('title'), p.get('text'), p.get('url')].map((s) => (s ?? '').trim()).filter(Boolean))]
  const kept = parts.filter((s, i) => !parts.some((o, j) => j !== i && o.length > s.length && o.includes(s)))
  const text = kept.join('\n').slice(0, MAX_SHARED).trim()
  return { newEntry: p.get('new') === '1' || text !== '', text }
}

/**
 * The same address without the launch words (path, other parameters and `#` kept), for `history.replaceState` once they
 * are read, so reloading the page does not put the shared text back.
 */
export function cleanLaunchUrl(href: string): string {
  const u = new URL(href)
  for (const k of PARAMS) u.searchParams.delete(k)
  return u.pathname + u.search + u.hash
}
