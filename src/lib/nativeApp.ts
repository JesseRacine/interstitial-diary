/*
 * The Windows and Android apps (a Tauri shell, see the interstitial-diary-app repo) already contain the whole site, so
 * the browser-style "saved copy of the site" (the service worker, which lets the *website* open offline) adds nothing
 * there. Worse, after a new build is installed the old saved copy is served first, so the old version shows until the
 * user finds the "Reload" banner. In the native apps the saved copy is therefore never created and any left over from
 * earlier builds is removed once. The website and the installed web app are untouched.
 */

/** True inside the native apps: they open the site from `tauri.localhost` (Windows, Android) or `tauri://` (macOS, iOS). */
export function isNativeApp(loc: Pick<Location, 'hostname' | 'protocol'>): boolean {
  return loc.hostname === 'tauri.localhost' || loc.protocol === 'tauri:'
}

/** What the clean-up needs from the browser; the real one is `browserDeps`. */
export interface SavedSiteDeps {
  registrations(): Promise<ReadonlyArray<{ unregister(): Promise<boolean> }>>
  cacheNames(): Promise<string[]>
  deleteCache(name: string): Promise<boolean>
}

export const browserDeps = (): SavedSiteDeps => ({
  registrations: async () => (typeof navigator !== 'undefined' && navigator.serviceWorker ? navigator.serviceWorker.getRegistrations() : []),
  cacheNames: async () => (typeof caches !== 'undefined' ? caches.keys() : []),
  deleteCache: (name) => caches.delete(name),
})

/**
 * Remove every service worker and cached file of this site. Returns whether there was anything to remove. Each failure is
 * skipped rather than thrown: leaving a saved copy behind is no worse than before. Touches no entries or photos (those
 * are in the database, which is not part of a service worker's caches).
 */
export async function removeSavedSite(deps: SavedSiteDeps = browserDeps()): Promise<boolean> {
  let found = false
  for (const r of await deps.registrations().catch(() => [])) {
    found = true
    await r.unregister().catch(() => false)
  }
  for (const name of await deps.cacheNames().catch(() => [])) {
    found = true
    await deps.deleteCache(name).catch(() => false)
  }
  return found
}

const RELOADED = 'saved-site-removed'

/**
 * For the native apps, at startup: remove an old saved copy, and if there was one reload the page once so the fresh
 * files are shown. The flag keeps it from ever reloading twice in one session. Never throws.
 */
export async function dropSavedSiteAndReload(
  reload: () => void = () => location.reload(),
  flag: Pick<Storage, 'getItem' | 'setItem'> | null = safeSessionStorage(),
  deps: SavedSiteDeps = browserDeps(),
): Promise<void> {
  try {
    if (!(await removeSavedSite(deps))) return
    if (flag?.getItem(RELOADED)) return
    flag?.setItem(RELOADED, '1')
    reload()
  } catch {
    // nothing to do: the app works with or without the saved copy
  }
}

function safeSessionStorage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}
