# Progress and next steps

_Last updated: 2026-11-09_

## Done

| Commit | What |
|---|---|
| 3aad18f | Vite + React + TypeScript scaffold in WSL; Dexie, MiniSearch, ulid, Vitest |
| 92f76f8 | Local journal: capture, day timeline, search (full syntax), results histogram, saved/recent searches, calendar heatmap, tags page with rename, settings, export to Markdown zip; Markdown format and merge logic with tests |
| 1e0d668 | Modular storage: sync engine, "Folder on this computer" and "Files inside this browser" modules, auto-sync, status badge |
| 9747fca | Fix: edits made to existing entries directly in the files were overwritten; now they win |
| 05c214a | Chat-style journal: one scrolling chat with the capture bar pinned at the bottom; left-aligned bubbles; two layouts (`Days` = a box per day, `Stream` = one continuous chat), remembered in localStorage; virtualised with `react-virtuoso` so two years (7,300 entries) scroll smoothly (~24 rows in the DOM); jump from calendar/search/date picker; `lib/journalRows.ts` + tests |

| 5d66390 | Images 1.1: `ImageRef` data model, `withDerived` keeps images, Dexie v2 (`thumbs`, `blobs`) |
| 725ab6e | Images 1.2: image lines in day files (backward compatible; hand-written ids unchanged) |
| 82ecaa0 | Images 1.3: sync treats image lines changed by hand as edits |
| d934111 | Images 1.4: hashing, type sniffing, thumbnail worker (EXIF rotation), `attachImage` |
| 8bbe2d7 | Images 1.5: blob methods on `FileStore`; `pushImages` writes originals + thumbnails before day files |
| c7f17cf | Images 1.6: attach photos in the capture box (paste, drop, pick) |
| f1dcd22 | Images 1.7: photos in bubbles, sized before decode; add/remove while editing |
| 0cb6125 | Images 1.8: lightbox (zoom, pan, keys, back button, save, remove) |
| 924391e | Images 1.9: export with photos (streamed zip, per year over 4 GB); then 1.10: docs, phase 1 done |

| 937a468 | Images 2.1: `pullImages` after the text sync: thumbnails to other devices, rebuild missing ones |

| 6e8117c | Images 2.2: originals downloaded when opened; bounded original cache (only safe copies dropped) |

| 811c738 | Images 2.3: "Not synced yet" placeholder for photos the last sync found nowhere |

| 9dadbe1 | Images 2.4: badge shows "N photos waiting" (live); fix: re-attached photo now marked as stored |

| 5a2c729 | Images 2.5: docs (DESIGN.md image sync + storage modules), two-device "done when" test; phase 2 done |

| aba1edd | Images 3.1: `has:image` / `-has:image` search filter, "With photos" chip, help row, DESIGN.md |
| 97b5ff1 | Images 3.2: Photos view (virtualised thumbnail grid by day, tile opens the lightbox, day heading opens the journal) |
| 5e3ccbe | Images 3.3: "Photos on this device" card in Settings (space used, browser estimate, adjustable original-cache limit) |
| 4e9a162 | Images 3.4: "Remove photos of deleted entries" (confirmed, sync-first cleanup; `storage/cleanup.ts`, `removeBlob` on stores) |
| (3.5, hash to add) | Images 3.5: "only in this browser" warning with photo wording (Settings box, header badge); phase 3 done |

248 tests pass (`npm test`). The user has tried the folder module with a real Windows folder, including editing a
file in Notepad.

## Next steps (in order)

### 1. Images in entries (phases 1, 2 and 3 done; phase 4 comes with pCloud)
- Planned in [images-plan.md](images-plan.md) (four phases, with tests for every sync/format change); its status line
  records what each step decided.
- **Phase 1 (done 2026-11-09):** attach, show, open full size, export, and write originals to the storage folder.
  Checked on `127.0.0.1` with "Files inside this browser" (originals, thumbnails and image lines land in storage), the
  2-year check (no row jumps in Days or Stream), 375 px, light and dark.
  **Still to confirm by the user:** with the real Windows folder, attach a photo on `localhost:5173` and check that
  `<folder>\2026\images\` and `<folder>\.thumbs\` get the files after the next save; and try one real export with
  photos through the Save dialog.
- **Phase 2 (done 2026-11-09):** images on other devices. Thumbnails reach another device in the sync that brings
  the entry (or are rebuilt from a local original), originals download when opened (hash-checked, bounded ~1 GB
  cache), "Not synced yet" for photos found nowhere, "N photos waiting" in the badge, failures retried next sync.
  Checked in the browser step by step and by a two-device test. **Still to confirm by the user:** a real second
  device; that needs hosting or a shared folder (e.g. pCloud Drive) between two browsers.
- **Phase 3 (done 2026-11-09)** (see the plan): `has:image` search, a Photos view, photo storage and the original-cache
  limit in Settings, removing photos of deleted entries, and the "only in this browser" warning with photo wording
  (Settings box; header badge when there are photos and no storage). **Still to confirm by the user:** with the real Windows folder, (a) the cache limit (lower it, and see originals leave the browser only once
  saved to the folder) and (b) "Photos of deleted entries" (delete an entry that has a photo, then run it and see the
  files leave `<folder>\<year>\images\` and `.thumbs\`); the folder picker can't be driven from the pane. Phase 4 (images on pCloud) comes with the pCloud module (step 5 below).

### 2. Make it an installable PWA
- Add `vite-plugin-pwa` (already a dev dependency) to `vite.config.ts`: manifest (name, short_name "Interstitial",
  theme colours from `index.css`, `display: standalone`, `start_url`), and a `shortcuts` entry "New entry" that opens
  the journal with the capture box focused.
- App icons (192, 512, maskable) in `public/`, replacing the Vite favicon.
- Service worker: precache the app shell so it works offline; prompt-to-reload when a new version is available.
  It must also precache the image worker chunk (`assets/images.worker-*.js`), or photos can't be attached offline.
- **Done when:** Edge offers "Install", the installed app opens in its own window offline, and Lighthouse PWA checks pass.

### 3. Data-safety features
- Settings shows whether persistent storage was granted (`navigator.storage.persisted()`).
- A warning when no file storage is set up ("Entries are only in this browser"). **Partly done (images 3.5):** the
  Settings storage card shows it (also for "Files inside this browser", which isn't a backup), worded for photos when
  the device holds any; the header badge shows "Photos only in this browser" once there are photos. Still to do: decide
  whether entries-only users should also get the header badge.
- On platforms without the folder module (Android), a periodic export/backup reminder until pCloud exists.
- **Done when:** each state is visible in Settings and tested at phone width.

### 4. Hosting (needs the user)
- **Open decision:** GitHub Pages (recommended: the same GitHub account later covers native builds in Actions and a
  possible GitHub storage module) or Cloudflare Pages.
- The user needs to create the account/repo; then add a deploy workflow and set Vite `base` if the site is served
  from a sub-path.
- Note: browser data belongs to the exact address, so pick the final address early (moving later starts the
  installed app empty, though files in a folder or pCloud carry over).
- **Done when:** the app is installed on both Windows and Android from the hosted address.

### 5. pCloud storage module
- See DESIGN.md "pCloud notes". The user registers an app in pCloud's developer console (needs the hosted address
  for the OAuth redirect) and provides the client id.
- Implement `storage/backends/pcloud.ts`; handle the US/EU region; token stored in the backend config.
- **Done when:** an entry written on Windows appears on Android and vice versa, including offline edits on both.

### 6. Native apps (Tauri)
- The user wants a "real app", with the PWA first. Wrap the same build with Tauri 2; build the Windows `.exe` and
  Android `.apk` in GitHub Actions (keeps Rust/Android SDK off the user's machine).
- Native extras: global hotkey + tray on Windows; a native-folder storage module for Android.
- Android quick capture (home-screen widget, pop-up entry box): planned in [android-capture-plan.md](android-capture-plan.md).
  Its stage 1 (open straight to capture, share target) belongs with the PWA and hosting steps.

## Known limitations
- Unsaved edits to an existing entry are lost if you scroll far enough that its row leaves the screen (the journal is virtualised).
- Removing an entry from a file by hand doesn't delete it (by design; see DESIGN.md).
- The folder module needs Chrome/Edge on desktop and usually needs "Reconnect folder" after a browser restart.
- On Android there is currently no copy outside the browser.
- No import of existing notes from other apps yet (export only).
- Export with photos only includes originals currently on the device; on a computer with the folder module, photos
  dropped from the browser cache (over about 1 GB) are left out of the zip (they are still in the folder).
- A photo file deleted by hand from the storage folder after it was saved there is not written back.
- An unsaved edit's photo references can be lost like its text (see the first point), but the photo bytes are already
  saved in the browser and are never lost.

## Ideas backlog
- Restyle search results to match the chat look (they still use cards).
- Idle nudge ("you haven't logged in 90 minutes").
- Weekly review page: entries per day, top tags, time-of-day patterns.
- Edit an entry's time.
- Incremental search indexing if the journal gets very large.
- GitHub storage module.
