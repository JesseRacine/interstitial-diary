# Progress and next steps

_Last updated: 2026-11-08_

## Done

| Commit | What |
|---|---|
| 3aad18f | Vite + React + TypeScript scaffold in WSL; Dexie, MiniSearch, ulid, Vitest |
| 92f76f8 | Local journal: capture, day timeline, search (full syntax), results histogram, saved/recent searches, calendar heatmap, tags page with rename, settings, export to Markdown zip; Markdown format and merge logic with tests |
| 1e0d668 | Modular storage: sync engine, "Folder on this computer" and "Files inside this browser" modules, auto-sync, status badge |
| 9747fca | Fix: edits made to existing entries directly in the files were overwritten; now they win |
| (uncommitted) | Chat-style journal: one scrolling chat with the capture bar pinned at the bottom; left-aligned bubbles; two layouts (`Days` = a box per day, `Stream` = one continuous chat), remembered in localStorage; virtualised with `react-virtuoso` so two years (7,300 entries) scroll smoothly (~24 rows in the DOM); jump from calendar/search/date picker; `lib/journalRows.ts` + tests |

73 tests pass (`npm test`). The user has tried the folder module with a real Windows folder, including editing a
file in Notepad.

## Next steps (in order)

### 1. Make it an installable PWA
- Add `vite-plugin-pwa` (already a dev dependency) to `vite.config.ts`: manifest (name, short_name "Interstitial",
  theme colours from `index.css`, `display: standalone`, `start_url`), and a `shortcuts` entry "New entry" that opens
  the journal with the capture box focused.
- App icons (192, 512, maskable) in `public/`, replacing the Vite favicon.
- Service worker: precache the app shell so it works offline; prompt-to-reload when a new version is available.
- **Done when:** Edge offers "Install", the installed app opens in its own window offline, and Lighthouse PWA checks pass.

### 2. Data-safety features
- Settings shows whether persistent storage was granted (`navigator.storage.persisted()`).
- A warning when no file storage is set up ("Entries are only in this browser").
- On platforms without the folder module (Android), a periodic export/backup reminder until pCloud exists.
- **Done when:** each state is visible in Settings and tested at phone width.

### 3. Hosting (needs the user)
- **Open decision:** GitHub Pages (recommended: the same GitHub account later covers native builds in Actions and a
  possible GitHub storage module) or Cloudflare Pages.
- The user needs to create the account/repo; then add a deploy workflow and set Vite `base` if the site is served
  from a sub-path.
- Note: browser data belongs to the exact address, so pick the final address early (moving later starts the
  installed app empty, though files in a folder or pCloud carry over).
- **Done when:** the app is installed on both Windows and Android from the hosted address.

### 4. pCloud storage module
- See DESIGN.md "pCloud notes". The user registers an app in pCloud's developer console (needs the hosted address
  for the OAuth redirect) and provides the client id.
- Implement `storage/backends/pcloud.ts`; handle the US/EU region; token stored in the backend config.
- **Done when:** an entry written on Windows appears on Android and vice versa, including offline edits on both.

### 5. Native apps (Tauri)
- The user wants a "real app", with the PWA first. Wrap the same build with Tauri 2; build the Windows `.exe` and
  Android `.apk` in GitHub Actions (keeps Rust/Android SDK off the user's machine).
- Native extras: global hotkey + tray on Windows; a native-folder storage module for Android.

## Known limitations
- Removing an entry from a file by hand doesn't delete it (by design; see DESIGN.md).
- The folder module needs Chrome/Edge on desktop and usually needs "Reconnect folder" after a browser restart.
- On Android there is currently no copy outside the browser.
- No import of existing notes from other apps yet (export only).

## Ideas backlog
- Idle nudge ("you haven't logged in 90 minutes").
- Weekly review page: entries per day, top tags, time-of-day patterns.
- Edit an entry's time.
- Incremental search indexing if the journal gets very large.
- GitHub storage module.
